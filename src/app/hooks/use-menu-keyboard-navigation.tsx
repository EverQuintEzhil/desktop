import { useEffect } from 'react';

interface UseMenuKeyboardNavigationOptions {
    isOpen: boolean;
    menuItemSelector?: string;
    popupSelector?: string;
    onTabOnLastItem?: () => void;
    lastItemSelector?: string;
    autoFocusFirstItem?: boolean;
}

const useMenuKeyboardNavigation = (options: UseMenuKeyboardNavigationOptions) => {
    const {
        isOpen,
        menuItemSelector = '[data-menu-item]',
        popupSelector = '[role="tooltip"]',
        onTabOnLastItem,
        lastItemSelector,
        autoFocusFirstItem = true,
    } = options;

    useEffect(() => {
        if (!isOpen) return;

        const getMenuItems = (popup: Element): HTMLElement[] => {
            return Array.from(popup.querySelectorAll(menuItemSelector)).filter((el) => {
                const element = el as HTMLElement;

                return (
                    !element.hasAttribute('disabled') &&
                    !element.hasAttribute('aria-hidden') &&
                    element.offsetParent !== null
                );
            }) as HTMLElement[];
        };

        const focusFirstMenuItem = () => {
            const popup = document.querySelector(popupSelector);

            if (popup) {
                const menuItems = getMenuItems(popup);

                if (menuItems.length > 0) {
                    menuItems[0]?.focus();

                    return true;
                }
            }

            return false;
        };

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        if (autoFocusFirstItem && !focusFirstMenuItem()) {
            timeoutId = setTimeout(() => {
                focusFirstMenuItem();
            }, 10);
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement as HTMLElement;
            const popup = activeElement?.closest(popupSelector);

            if (!popup) return;

            if (e.key === 'Tab' && !e.shiftKey && onTabOnLastItem && lastItemSelector) {
                const lastItem = popup.querySelector(lastItemSelector) as HTMLElement;

                if (activeElement === lastItem) {
                    const focusableElements = Array.from(
                        popup.querySelectorAll(
                            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                        ),
                    ).filter((el) => {
                        const element = el as HTMLElement;

                        return (
                            !element.hasAttribute('disabled') &&
                            !element.hasAttribute('aria-hidden') &&
                            element.offsetParent !== null
                        );
                    });

                    if (focusableElements.length > 0 && focusableElements[focusableElements.length - 1] === lastItem) {
                        e.preventDefault();
                        e.stopPropagation();
                        onTabOnLastItem();
                    }
                }
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const menuItems = getMenuItems(popup);

                if (menuItems.length === 0) return;

                const currentIndex = menuItems.findIndex(
                    (item) => item === activeElement || item.contains(activeElement),
                );

                if (currentIndex === -1) {
                    menuItems[0]?.focus();
                    e.preventDefault();

                    return;
                }

                let nextIndex: number;

                if (e.key === 'ArrowDown') {
                    nextIndex = currentIndex === menuItems.length - 1 ? 0 : currentIndex + 1;
                } else {
                    nextIndex = currentIndex === 0 ? menuItems.length - 1 : currentIndex - 1;
                }

                menuItems[nextIndex]?.focus();
                e.preventDefault();
                e.stopPropagation();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [isOpen, menuItemSelector, popupSelector, onTabOnLastItem, lastItemSelector, autoFocusFirstItem]);
};

export default useMenuKeyboardNavigation;
