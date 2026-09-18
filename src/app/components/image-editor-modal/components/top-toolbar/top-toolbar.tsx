import {
    ChevronDownIcon,
    CopyIcon,
    DownloadIcon,
    RotateCcwIcon,
    RotateCwIcon,
    XIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import './top-toolbar.scss';

export type ExportFormatOption = 'jpeg' | 'png' | 'webp';

export interface TopToolbarProps {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onModalClose: () => void;
    onExport: () => void;
    exporting: boolean;
    onCopy?: () => void;
    copying?: boolean;
    onExportAs?: (format: ExportFormatOption) => void;
    zoomLevel: number;
    zoomPresets: number[];
    canZoomIn: boolean;
    canZoomOut: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomChange: (zoom: number) => void;
    onAutoFit: () => void;
}

const EXPORT_FORMATS: ExportFormatOption[] = ['jpeg', 'png', 'webp'];

const TopToolbar = (props: TopToolbarProps) => {
    const {
        canUndo = false,
        canRedo = false,
        onUndo,
        onRedo,
        onModalClose,
        onExport,
        exporting = false,
        onCopy,
        copying = false,
        onExportAs,
        zoomLevel = 100,
        zoomPresets = [200, 100, 50],
        canZoomIn = true,
        canZoomOut = true,
        onZoomIn,
        onZoomOut,
        onZoomChange,
        onAutoFit,
    } = props;

    const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    const handleZoomPreset = (preset: number) => {
        setIsZoomMenuOpen(false);
        onZoomChange?.(preset);
    };

    return (
        <div className="top-toolbar z-5 flex shrink-0 items-center justify-between gap-3 px-4 py-2">
            <div className="toolbar-group-start flex items-center justify-start gap-2">
                <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo}>
                    <RotateCcwIcon />
                    Undo
                </Button>
                <Button variant="outline" size="sm" onClick={onRedo} disabled={!canRedo}>
                    <RotateCwIcon />
                    Redo
                </Button>
            </div>

            <div className="toolbar-group-end flex items-center justify-end gap-2">
                <div className="zoom-controls flex items-center gap-2">
                    <SimpleTooltip content="Zoom out" side="bottom">
                        <Button
                            variant="outline"
                            className="hide-mobile"
                            size="icon-sm"
                            onClick={() => onZoomOut()}
                            disabled={!canZoomOut}
                        >
                            <ZoomOutIcon />
                        </Button>
                    </SimpleTooltip>
                    <Popover open={isZoomMenuOpen} onOpenChange={setIsZoomMenuOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                    <div className="zoom-dropdown-trigger inline-flex h-8 items-center gap-2 px-3">
                                        <span className="text-xs font-medium text-primary">{`${Math.round(zoomLevel)}%`}</span>
                                        <ChevronDownIcon className="size-4" />
                                    </div>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">See more zoom options</TooltipContent>
                        </Tooltip>
                        <PopoverContent align="center" side="bottom" sideOffset={4} className="min-w-[180px] p-1">
                            <div
                                className="zoom-menu-item flex items-center justify-between p-2"
                                onClick={() => {
                                    setIsZoomMenuOpen(false);
                                    onAutoFit();
                                }}
                            >
                                <div className="zoom-menu-left flex items-center">
                                    <span className="text-sm">Auto-Fit Page</span>
                                </div>
                            </div>

                            <div className="zoom-menu-separator" />

                            {zoomPresets.map((preset) => {
                                const isSelected = Math.abs(preset - zoomLevel) < 1;

                                return (
                                    <div
                                        className={`zoom-menu-item flex items-center justify-between p-2 ${isSelected ? 'selected' : ''}`}
                                        key={preset}
                                        onClick={() => handleZoomPreset(preset)}
                                    >
                                        <span className="text-sm">{`${preset}% Zoom`}</span>
                                    </div>
                                );
                            })}

                            <div className="zoom-menu-separator" />

                            <div
                                className={`zoom-menu-item flex items-center justify-between p-2 ${!canZoomIn ? 'disabled' : ''}`}
                                onClick={() => {
                                    setIsZoomMenuOpen(false);
                                    onZoomIn();
                                }}
                            >
                                <span className="text-sm">Zoom In</span>
                                <span className="text-sm">+</span>
                            </div>
                            <div
                                className={`zoom-menu-item flex items-center justify-between p-2 ${!canZoomOut ? 'disabled' : ''}`}
                                onClick={() => {
                                    setIsZoomMenuOpen(false);
                                    onZoomOut();
                                }}
                            >
                                <span className="text-sm">Zoom Out</span>
                                <span className="text-sm">-</span>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <SimpleTooltip content="Zoom in" side="bottom">
                        <Button
                            variant="outline"
                            size="icon-sm"
                            className="hide-mobile"
                            onClick={() => onZoomIn()}
                            disabled={!canZoomIn}
                        >
                            <ZoomInIcon />
                        </Button>
                    </SimpleTooltip>
                </div>
                {onCopy && (
                    <SimpleTooltip content="Copy image" side="bottom">
                        <Button variant="outline" onClick={onCopy} size="icon-sm" disabled={copying || exporting}>
                            <CopyIcon />
                        </Button>
                    </SimpleTooltip>
                )}
                {onExportAs ? (
                    <Popover open={isExportMenuOpen} onOpenChange={setIsExportMenuOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={exporting || copying}>
                                        Export
                                        <ChevronDownIcon className="size-4" />
                                    </Button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Export image</TooltipContent>
                        </Tooltip>
                        <PopoverContent align="end" side="bottom" sideOffset={4} className="min-w-[180px] p-1">
                            {EXPORT_FORMATS.map((format) => (
                                <div
                                    key={format}
                                    className="zoom-menu-item flex items-center justify-between p-2"
                                    onClick={() => {
                                        setIsExportMenuOpen(false);
                                        onExportAs(format);
                                    }}
                                >
                                    <span className="text-sm">Download as {format.toUpperCase()}</span>
                                </div>
                            ))}
                        </PopoverContent>
                    </Popover>
                ) : (
                    <Button
                        variant="outline"
                        onClick={onExport}
                        // loading={exporting}
                        disabled={exporting}
                    >
                        <DownloadIcon />
                        Export Image
                        <ChevronDownIcon className="size-4" />
                    </Button>
                )}
                <SimpleTooltip content="Close editor" side="bottom">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Close editor"
                        className="close-media-editor"
                        onClick={onModalClose}
                    >
                        <XIcon />
                    </Button>
                </SimpleTooltip>
            </div>
        </div>
    );
};

export default TopToolbar;
