import React, { CSSProperties, HTMLAttributes } from 'react';

const cardStyle: CSSProperties = {
    borderRadius: '0.75rem',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(0, 0, 0, 0.1)'
};

const cardHeaderStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 1.5rem 0 1.5rem'
};

const cardTitleStyle: CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.2,
    margin: 0
};

const cardDescriptionStyle: CSSProperties = {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
    marginBottom: 0
};

const cardContentStyle: CSSProperties = {
    padding: '1.5rem'
};

const cardFooterStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '1.5rem',
    borderTop: '1px solid rgba(0, 0, 0, 0.1)'
};

export const Card = ({ style, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div style={{ ...cardStyle, ...style }} {...props} />
);

export const CardHeader = ({ style, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div style={{ ...cardHeaderStyle, ...style }} {...props} />
);

export const CardTitle = ({ style, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 style={{ ...cardTitleStyle, ...style }} {...props} />
);

export const CardDescription = ({ style, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
    <p style={{ ...cardDescriptionStyle, ...style }} {...props} />
);

export const CardContent = ({ style, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div style={{ ...cardContentStyle, ...style }} {...props} />
);

export const CardFooter = ({ style, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div style={{ ...cardFooterStyle, ...style }} {...props} />
); 