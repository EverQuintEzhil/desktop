import { CheckIcon, XIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { type SuggestionItem as ISuggestionItem } from '@/components/auto-complete';
import { Button } from '@/components/ui/button';
import { Input as InputNormal } from '@/components/ui/input';
import Tag, { type TagProps } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

import './tags-input.scss';

export interface TagSuggestionItem<T = string | number | object | null> extends ISuggestionItem<T> {
    removable?: boolean;
}

interface TagsInputProps<T = string | number | object | null> {
    addNewlabel?: string;
    disabled?: boolean;
    newSuggestion?: {
        allowChangeWithoutAction?: boolean;
        label?: string;
        enabled?: boolean;
        action: (item: TagSuggestionItem<T>) => void;
        maxLength?: number;
    };
    value?: TagSuggestionItem<T>[];
    onChange?: (value: TagSuggestionItem<T>[]) => void;
    onRemove?: (item: TagSuggestionItem<T>, index: number) => void;
    reverse?: boolean;
    tagProps?: TagProps;
    isError?: boolean;
    size?: 'small' | 'regular' | 'large';
}

interface RenderTagsProps {
    tags?: TagSuggestionItem[];
    removable?: boolean;
    onRemove: (index: number) => void;
    tagProps?: TagProps;
    size?: 'small' | 'regular' | 'large';
}

const RenderTags = ({ tags = [], removable, onRemove, tagProps, size = 'regular' }: RenderTagsProps) =>
    tags.map((tag, index: number) => (
        <Tag
            {...tagProps}
            {...tag}
            key={`tag-${tag.value}-${index}`}
            value={tag.value}
            label={tag.label}
            removable={typeof tag.removable !== 'undefined' ? tag.removable : removable}
            onRemove={() => onRemove(index)}
            size={size}
        />
    ));

interface AddTagProps {
    addNewlabel: string;
    disabled?: boolean;
    newSuggestion?: {
        allowChangeWithoutAction?: boolean;
        label?: string;
        enabled?: boolean;
        action: (item: TagSuggestionItem) => void;
        maxLength?: number;
    };
    onNewTag: (tag: TagSuggestionItem) => void;
    selected: TagSuggestionItem[];
    onBlur?: () => void;
    size?: 'small' | 'regular' | 'large';
}

const AddTagText = ({ addNewlabel, disabled, onNewTag, onBlur, size = 'regular', ...rest }: AddTagProps) => {
    const [showInput, setShowInput] = useState(false);
    const [value, setValue] = useState('');
    const [isBlur, setIsBlur] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    const updateValue = () => {
        if (value !== null) {
            onNewTag({
                label: value,
                value,
                removable: true,
            });
            setShowInput(false);
        }
    };

    useEffect(() => {
        if (isBlur === true) {
            setTimeout(() => {
                if (onBlur) {
                    onBlur();
                }
                setIsBlur(false);
            }, 0);
        }
    }, [isBlur, onBlur]);

    useEffect(() => {
        if (showInput === false) {
            setValue('');
        } else {
            inputRef.current?.focus();
        }
    }, [showInput]);

    if (showInput) {
        return (
            <div className="flex justify-center gap-1">
                <InputNormal
                    value={value}
                    ref={inputRef}
                    onChange={(e) => {
                        return setValue(e.target.value);
                    }}
                    {...rest}
                />
                <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon-sm" onClick={() => setShowInput(!showInput)}>
                        <XIcon />
                    </Button>
                    <Button
                        variant="default"
                        size="icon-sm"
                        onClick={() => {
                            updateValue();
                        }}
                    >
                        <CheckIcon />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <Tag
            disabled={disabled}
            value={`+ ${addNewlabel}`}
            label={`+ ${addNewlabel}`}
            selectable
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowInput(true);
            }}
            size={size}
        />
    );
};

export const TagsInputText = (props: TagsInputProps) => {
    const {
        addNewlabel = 'Add New Tag',
        disabled,
        newSuggestion,
        value: propValue,
        onChange,
        onRemove: onRemoveProp,
        reverse,
        tagProps,
        isError,
        size = 'regular',
        ...rest
    } = props;

    const [tags, setTags] = useState(Array.isArray(propValue) ? propValue : []);

    useEffect(() => {
        if (Array.isArray(propValue)) {
            setTags(propValue);
        }
    }, [propValue]);

    const onRemove = (index: number) => {
        const removedItem = tags[index];

        if (onChange) {
            onChange(tags.filter((_item, i: number) => index !== i));
        }
        if (onRemoveProp) {
            onRemoveProp(removedItem, index);
        }
    };

    const addNewTag = (tag: TagSuggestionItem) => {
        if (onChange) {
            if (reverse) {
                onChange([tag, ...tags]);
            } else {
                onChange([...tags, tag]);
            }
        }
    };

    return (
        <div className={cn('tags-input', isError && 'has-error')}>
            <div className="tag-group flex w-full flex-wrap gap-2">
                {reverse ? (
                    <>
                        {!disabled ? (
                            <AddTagText
                                disabled={disabled}
                                selected={tags}
                                onNewTag={addNewTag}
                                newSuggestion={newSuggestion}
                                addNewlabel={addNewlabel}
                                {...rest}
                            />
                        ) : null}
                        <div className="grouped mt-6 w-full">
                            <RenderTags tags={tags} removable={!disabled} onRemove={onRemove} tagProps={tagProps} />
                        </div>
                    </>
                ) : (
                    <>
                        <RenderTags
                            tags={tags}
                            removable={!disabled}
                            onRemove={onRemove}
                            tagProps={tagProps}
                            size={size}
                        />
                        {!disabled ? (
                            <AddTagText
                                disabled={disabled}
                                selected={tags}
                                onNewTag={addNewTag}
                                newSuggestion={newSuggestion}
                                addNewlabel={addNewlabel}
                                size={size}
                                {...rest}
                            />
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
};

export default TagsInputText;
