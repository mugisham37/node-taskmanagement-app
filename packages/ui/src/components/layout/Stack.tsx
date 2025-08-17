import * as React from 'react';
import { Flex, type FlexProps } from './Flex';

export interface StackProps extends Omit<FlexProps, 'direction'> {
  spacing?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ spacing, gap, ...props }, ref) => {
    return (
      <Flex
        ref={ref}
        direction="col"
        gap={gap || spacing}
        {...props}
      />
    );
  }
);

Stack.displayName = 'Stack';

export { Stack };
