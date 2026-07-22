'use client';
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient' | 'outline';
  hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = true, ...props }, ref) => {
    const variants = {
      default: 'bg-white border border-gray-100',
      gradient: 'bg-gradient-to-br from-white to-orange-50 border border-orange-200',
      outline: 'bg-transparent border-2 border-orange-500',
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl shadow-md p-6 transition-all duration-300',
          variants[variant],
          hover && 'hover:shadow-xl hover:border-orange-300',
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

export { Card };
