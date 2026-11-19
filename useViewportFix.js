import { useEffect, useState } from 'react';

export function useViewportFix() {
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      const currentHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      
      setViewportHeight(currentHeight);
      
      if (windowHeight - currentHeight > 150) {
        setIsKeyboardOpen(true);
        window.scrollTo(0, 0);
      } else {
        setIsKeyboardOpen(false);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  return { viewportHeight, isKeyboardOpen };
}