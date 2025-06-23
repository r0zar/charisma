import * as React from "react";

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
    const { className, ...rest } = props;
    return (
        <div
            ref={ref}
            className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:bg-card/80 ${className || ""}`}
            {...rest}
        />
    );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
    const { className, ...rest } = props;
    return (
        <div
            ref={ref}
            className={`flex flex-col space-y-1.5 p-6 ${className || ""}`}
            {...rest}
        />
    );
});
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>((props, ref) => {
    const { className, ...rest } = props;
    return (
        <h3
            ref={ref}
            className={`text-lg font-semibold leading-none tracking-tight ${className || ""}`}
            {...rest}
        />
    );
});
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>((props, ref) => {
    const { className, ...rest } = props;
    return (
        <p
            ref={ref}
            className={`text-sm text-muted-foreground ${className || ""}`}
            {...rest}
        />
    );
});
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
    const { className, ...rest } = props;
    return (
        <div ref={ref} className={`p-6 pt-0 ${className || ""}`} {...rest} />
    );
});
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
    const { className, ...rest } = props;
    return (
        <div
            ref={ref}
            className={`flex items-center p-6 pt-0 ${className || ""}`}
            {...rest}
        />
    );
});
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }; 