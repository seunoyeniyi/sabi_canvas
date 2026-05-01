import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNavProps } from '@sabi-canvas/types/editor';
import { cn } from '@sabi-canvas/lib/utils';

export const BottomNav: React.FC<BottomNavProps> = ({
  items,
  activeId,
  onItemClick,
  className,
}) => {
  return (
    <motion.nav
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'h-16 px-2 pb-safe',
        'bg-card border-t border-panel-border',
        'shadow-editor-lg',
        'lg:hidden', // Hide on desktop
        className
      )}
    >
      <div className="flex items-center justify-around h-full max-w-md mx-auto">
        {items.map((item) => {
          const isActive = item.id === activeId;
          
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={cn(
                'relative flex flex-col items-center justify-center',
                'w-16 h-full gap-0.5',
                'transition-colors duration-200',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {/* Active indicator */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute -top-1 w-8 h-1 rounded-full bg-primary"
                  />
                )}
              </AnimatePresence>

              {/* Icon with scale animation */}
              <motion.div
                animate={{ 
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="relative"
              >
                {item.icon}
                
                {/* Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </motion.div>

              {/* Label */}
              <span className={cn(
                'text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNav;
