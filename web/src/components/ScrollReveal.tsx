'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
  className?: string;
};

const variants = {
  hidden: (dir: string) => ({
    opacity: 0,
    y: dir === 'up' ? 24 : 0,
    x: dir === 'left' ? -24 : dir === 'right' ? 24 : 0,
  }),
  visible: { opacity: 1, y: 0, x: 0 },
};

export default function ScrollReveal({ children, delay = 0, direction = 'up', className }: Props) {
  return (
    <motion.div
      className={className}
      custom={direction}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
