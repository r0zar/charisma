import { cn } from '@/lib/utils';
import * as React from 'react';

interface DropdownMenuContextType {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | undefined>(undefined);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false);

    return (
        <DropdownMenuContext.Provider value={{ open, setOpen }}>
            <div className="relative inline-block text-left">
                {children}
            </div>
        </DropdownMenuContext.Provider>
    );
}

export const DropdownMenuTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

    const { open, setOpen } = context;

    const handleClick = () => setOpen(!open);

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
            ...props,
            ref,
            onClick: handleClick,
        } as any);
    }

    return (
        <button ref={ref} onClick={handleClick} {...props}>
            {children}
        </button>
    );
});

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
    align?: 'start' | 'center' | 'end';
}

export function DropdownMenuContent({
    children,
    className,
    align = 'center',
    ...props
}: DropdownMenuContentProps) {
    const context = React.useContext(DropdownMenuContext);
    if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

    const { open, setOpen } = context;
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [open, setOpen]);

    if (!open) return null;

    const alignmentClass = {
        start: 'left-0',
        center: 'left-1/2 -translate-x-1/2',
        end: 'right-0'
    }[align];

    return (
        <div
            ref={ref}
            className={cn(
                'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
                'top-full mt-1',
                alignmentClass,
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function DropdownMenuItem({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    const context = React.useContext(DropdownMenuContext);

    const handleClick = () => {
        context?.setOpen(false);
    };

    return (
        <div
            className={cn(
                'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                className
            )}
            onClick={handleClick}
            {...props}
        >
            {children}
        </div>
    );
}

export function DropdownMenuLabel({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('px-2 py-1.5 text-sm font-semibold', className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function DropdownMenuSeparator({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('-mx-1 my-1 h-px bg-muted', className)}
            {...props}
        />
    );
}