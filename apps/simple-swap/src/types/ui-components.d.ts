// Type declarations for custom UI components to work with React 19

// Fix for custom UI components in React 19
// declare module '@/components/ui/*' {
//     // Make all UI components compatible with React 19 JSX
//     const Component: React.FC<any>;
//     export default Component;
// }

// // Specifically fix Button component
// declare module '@/components/ui/button' {
//     import { ButtonHTMLAttributes } from 'react';

//     export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
//         variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
//         size?: 'default' | 'sm' | 'lg' | 'icon';
//         asChild?: boolean;
//         className?: string;
//     }

//     export const Button: React.FC<ButtonProps>;
//     export const buttonVariants: (props: any) => string;
// }

// // Fix Card components
// declare module '@/components/ui/card' {
//     export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>>;
//     export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>>;
//     export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
//     export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>>;
//     export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>>;
//     export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>>;
// } 