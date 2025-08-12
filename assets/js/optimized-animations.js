/**
 * Optimized Animation System for Team Atlanta Website
 * Consolidated from multiple animation files with performance optimizations
 */

class OptimizedAnimations {
  constructor() {
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isMobile = window.innerWidth < 768;
    this.isTouchDevice = 'ontouchstart' in window;
    this.performanceMode = this.detectPerformanceMode();
    
    this.eventManager = new EventManager();
    this.intersectionObserver = null;
    this.animationQueue = new Set();
    this.rafId = null;
    
    this.init();
  }

  detectPerformanceMode() {
    const indicators = {
      lowMemory: navigator.deviceMemory && navigator.deviceMemory < 4,
      lowCpuCores: navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4,
      slowConnection: navigator.connection && 
        ['slow-2g', '2g'].includes(navigator.connection.effectiveType),
      lowBattery: false
    };

    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        indicators.lowBattery = battery.level < 0.2;
        this.updatePerformanceMode(indicators);
      }).catch(() => {});
    }

    return Object.values(indicators).some(indicator => indicator) ? 'low' : 'normal';
  }

  updatePerformanceMode(indicators) {
    const isLowPerformance = Object.values(indicators).some(indicator => indicator);
    if (isLowPerformance && this.performanceMode !== 'low') {
      this.performanceMode = 'low';
      this.disableExpensiveAnimations();
    }
  }

  init() {
    if (this.isReducedMotion) {
      this.initAccessibleAlternatives();
      return;
    }

    this.setupAnimationCSS();
    this.initScrollAnimations();
    this.initInteractiveElements();
    this.initImageLoading();
    this.initMobileOptimizations();
    
    if (this.performanceMode === 'normal') {
      this.initEnhancedEffects();
    }

    this.setupEventListeners();
  }

  setupAnimationCSS() {
    const style = document.createElement('style');
    style.id = 'optimized-animations-css';
    style.textContent = `
      /* Core animation definitions */
      @keyframes fadeInUp {
        from { opacity: 0; transform: translate3d(0, 30px, 0); }
        to { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      
      @keyframes slideInLeft {
        from { opacity: 0; transform: translate3d(-30px, 0, 0); }
        to { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      
      @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      @keyframes ripple {
        to { transform: scale(4); opacity: 0; }
      }
      
      /* Optimized particle alternative */
      @keyframes floatParticle {
        0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        25% { transform: translate3d(10px, -10px, 0) rotate(90deg); }
        50% { transform: translate3d(-5px, -20px, 0) rotate(180deg); }
        75% { transform: translate3d(-10px, -10px, 0) rotate(270deg); }
      }
      
      /* Performance-optimized classes */
      .animate-in {
        animation: fadeInUp 0.6s ease-out forwards;
      }
      
      .animate-slide-in {
        animation: slideInLeft 0.6s ease-out forwards;
      }
      
      .animate-scale-in {
        animation: scaleIn 0.6s ease-out forwards;
      }
      
      .loading-spinner {
        animation: spin 1s linear infinite;
      }
      
      .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
      }
      
      /* CSS-only floating particles */
      .floating-particle {
        position: fixed;
        width: 3px;
        height: 3px;
        background: radial-gradient(circle, rgba(52, 152, 219, 0.6) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        animation: floatParticle 8s ease-in-out infinite;
        z-index: 1;
      }
      
      /* Interactive element enhancements */
      .interactive-element {
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform;
      }
      
      .interactive-element:hover {
        transform: translate3d(0, -2px, 0);
      }
      
      .interactive-element:active {
        transform: translate3d(0, 0, 0);
      }
      
      /* Mobile optimizations */
      @media (max-width: 768px) {
        .animate-in,
        .animate-slide-in,
        .animate-scale-in {
          animation-duration: 0.4s;
        }
        
        .floating-particle {
          display: none;
        }
        
        .interactive-element:hover {
          transform: none;
        }
      }
      
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .animate-in,
        .animate-slide-in,
        .animate-scale-in,
        .loading-spinner,
        .floating-particle {
          animation: none !important;
        }
        
        .interactive-element {
          transition: none !important;
        }
      }
      
      /* Performance containment */
      .animation-container {
        contain: layout style paint;
      }
      
      /* GPU acceleration hints */
      .hardware-accelerated {
        transform: translate3d(0, 0, 0);
        will-change: transform, opacity;
      }
    `;
    document.head.appendChild(style);
  }

  initScrollAnimations() {
    const observerOptions = {
      root: null,
      rootMargin: '50px 0px',
      threshold: 0.1
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.triggerAnimation(entry.target);
          this.intersectionObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe elements with animation attributes
    const animateElements = document.querySelectorAll('[data-animate], [data-scroll-animate]');
    animateElements.forEach(element => {
      element.style.opacity = '0';
      this.intersectionObserver.observe(element);
    });
  }

  triggerAnimation(element) {
    const animationType = element.dataset.animate || element.dataset.scrollAnimate || 'fadeInUp';
    
    element.style.opacity = '1';
    
    switch (animationType) {
      case 'slideLeft':
        element.classList.add('animate-slide-in');
        break;
      case 'scale':
        element.classList.add('animate-scale-in');
        break;
      default:
        element.classList.add('animate-in');
    }

    // Stagger child animations if specified
    const children = element.querySelectorAll('[data-stagger]');
    children.forEach((child, index) => {
      setTimeout(() => {
        child.style.opacity = '1';
        child.classList.add('animate-in');
      }, index * 100);
    });
  }

  initInteractiveElements() {
    const interactiveElements = document.querySelectorAll(
      '.btn, .card, .modern-card, button, [role="button"], a[href]'
    );

    interactiveElements.forEach(element => {
      if (element.dataset.optimizedInteraction) return;
      element.dataset.optimizedInteraction = 'true';

      element.classList.add('interactive-element');

      // Add touch ripple effect for touch devices
      if (this.isTouchDevice) {
        this.addRippleEffect(element);
      }

      // Add loading state capability to buttons
      if (element.matches('button, .btn, [role="button"]')) {
        this.addLoadingCapability(element);
      }

      // Enhanced hover effects for cards
      if (element.matches('.card, .modern-card')) {
        this.addCardEffects(element);
      }
    });
  }

  addRippleEffect(element) {
    element.style.position = 'relative';
    element.style.overflow = 'hidden';

    element.addEventListener('touchstart', (e) => {
      if (this.isReducedMotion) return;

      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.touches[0].clientX - rect.left - size / 2;
      const y = e.touches[0].clientY - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';

      element.appendChild(ripple);

      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 600);
    }, { passive: true });
  }

  addLoadingCapability(button) {
    const originalContent = button.innerHTML;

    button.setLoadingState = (loading = true) => {
      if (loading) {
        button.disabled = true;
        button.classList.add('loading');
        
        if (!this.isReducedMotion) {
          button.innerHTML = `
            <span class="loading-spinner" style="
              display: inline-block;
              width: 16px;
              height: 16px;
              border: 2px solid transparent;
              border-top: 2px solid currentColor;
              border-radius: 50%;
              margin-right: 8px;
            "></span>Loading...
          `;
        } else {
          button.innerHTML = 'Loading...';
        }
      } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = originalContent;
      }
    };

    button.showSuccess = (duration = 2000) => {
      const originalClass = button.className;
      button.style.background = '#10b981';
      button.style.color = 'white';
      button.innerHTML = '<span style="margin-right: 8px;">✓</span>Success!';
      
      setTimeout(() => {
        button.className = originalClass;
        button.innerHTML = originalContent;
        button.style.background = '';
        button.style.color = '';
      }, duration);
    };
  }

  addCardEffects(card) {
    const originalBoxShadow = getComputedStyle(card).boxShadow;
    const originalTransition = getComputedStyle(card).transition;

    card.addEventListener('mouseenter', () => {
      if (this.isMobile) return;
      
      card.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
      card.style.boxShadow = '0 10px 25px rgba(44, 62, 80, 0.15)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transition = originalTransition || 'box-shadow 0.3s ease, transform 0.3s ease';
      card.style.boxShadow = originalBoxShadow;
    });
  }

  initImageLoading() {
    const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            imageObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '100px' });

      images.forEach(img => imageObserver.observe(img));
    } else {
      images.forEach(img => this.loadImage(img));
    }
  }

  loadImage(img) {
    const src = img.dataset.src || img.src;
    if (!src || img.dataset.loaded) return;

    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0.5';

    const newImage = new Image();
    newImage.onload = () => {
      img.src = src;
      img.style.opacity = '1';
      img.dataset.loaded = 'true';
      delete img.dataset.src;
    };
    
    newImage.onerror = () => {
      img.style.opacity = '1';
      img.dataset.loaded = 'error';
    };
    
    newImage.src = src;
  }

  initMobileOptimizations() {
    if (!this.isMobile) return;

    // Disable expensive effects on mobile
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        .glass-card {
          backdrop-filter: blur(5px) !important;
        }
        
        * {
          transition-duration: 0.2s !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Add touch-specific optimizations
    document.body.style.touchAction = 'manipulation';
    document.body.style.overscrollBehavior = 'none';
  }

  initEnhancedEffects() {
    if (this.performanceMode === 'low') return;

    // Create lightweight CSS-only floating particles
    this.createFloatingParticles(15);
    
    // Add parallax effect to specific elements
    this.initParallax();
  }

  createFloatingParticles(count) {
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'floating-particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 8 + 's';
      particle.style.animationDuration = (6 + Math.random() * 4) + 's';
      
      document.body.appendChild(particle);
    }
  }

  initParallax() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    if (parallaxElements.length === 0) return;

    let ticking = false;
    const updateParallax = () => {
      const scrolled = window.pageYOffset;
      
      parallaxElements.forEach(element => {
        const speed = parseFloat(element.dataset.parallax) || 0.5;
        const yPos = -(scrolled * speed);
        element.style.transform = `translate3d(0, ${yPos}px, 0)`;
      });
      
      ticking = false;
    };

    this.eventManager.addListener(window, 'scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }

  setupEventListeners() {
    // Optimized scroll handler
    let scrollTicking = false;
    this.eventManager.addListener(window, 'scroll', () => {
      if (!scrollTicking) {
        requestAnimationFrame(() => {
          this.handleScroll();
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    }, { passive: true });

    // Optimized resize handler
    this.eventManager.addListener(window, 'resize', 
      this.debounce(() => {
        this.handleResize();
      }, 250)
    );

    // Handle navigation focus
    this.eventManager.addListener(document, 'keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    this.eventManager.addListener(document, 'mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });
  }

  handleScroll() {
    // Minimal scroll handling - most scroll effects are now CSS-based
    if (this.animationQueue.size > 0) {
      this.processAnimationQueue();
    }
  }

  handleResize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;
    
    if (wasMobile !== this.isMobile) {
      // Reinitialize mobile optimizations if needed
      if (this.isMobile) {
        this.initMobileOptimizations();
      }
    }
  }

  processAnimationQueue() {
    this.animationQueue.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Animation callback error:', error);
      }
    });
    this.animationQueue.clear();
  }

  initAccessibleAlternatives() {
    const style = document.createElement('style');
    style.textContent = `
      .loading-state {
        border-left: 3px solid var(--primary-color, #3498db);
        padding-left: 0.5rem;
      }
      
      .focus-ring {
        outline: 2px solid var(--primary-color, #3498db);
        outline-offset: 2px;
      }
      
      .active-state {
        background-color: var(--primary-light, #ebf3fd);
      }
    `;
    document.head.appendChild(style);
  }

  disableExpensiveAnimations() {
    // Remove floating particles
    document.querySelectorAll('.floating-particle').forEach(particle => {
      particle.remove();
    });

    // Disable complex animations
    const style = document.createElement('style');
    style.textContent = `
      .glass-card {
        backdrop-filter: none !important;
      }
      
      .animate-in,
      .animate-slide-in,
      .animate-scale-in {
        animation: none !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }

  debounce(func, wait = 250) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  destroy() {
    this.eventManager.removeAllListeners();
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    this.animationQueue.clear();
    
    // Remove floating particles
    document.querySelectorAll('.floating-particle').forEach(particle => {
      particle.remove();
    });
    
    // Remove added styles
    const optimizedStyles = document.querySelector('#optimized-animations-css');
    if (optimizedStyles) {
      optimizedStyles.remove();
    }
  }
}

class EventManager {
  constructor() {
    this.listeners = new Map();
  }

  addListener(element, event, handler, options = {}) {
    const key = `${element.constructor.name}-${event}`;
    
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    
    this.listeners.get(key).push({ element, handler, options });
    element.addEventListener(event, handler, options);
  }

  removeAllListeners() {
    this.listeners.forEach((listeners) => {
      listeners.forEach(({ element, handler, options }) => {
        element.removeEventListener(handler, options);
      });
    });
    this.listeners.clear();
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.OptimizedAnimations = OptimizedAnimations;
  
  document.addEventListener('DOMContentLoaded', () => {
    window.optimizedAnimations = new OptimizedAnimations();
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.optimizedAnimations) {
      window.optimizedAnimations.destroy();
    }
  });
}