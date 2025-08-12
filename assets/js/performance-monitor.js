/**
 * Performance Monitoring and Web Vitals Tracking
 * Lightweight performance monitoring for Team Atlanta website
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fcp: null,
      lcp: null,
      fid: null,
      cls: null,
      ttfb: null
    };
    
    this.observers = [];
    this.isSupported = 'PerformanceObserver' in window;
    
    if (this.isSupported) {
      this.init();
    }
  }

  init() {
    this.measureTTFB();
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeFCP();
    this.observeLongTasks();
    
    // Report metrics after page load
    window.addEventListener('load', () => {
      setTimeout(() => this.reportMetrics(), 1000);
    });

    // Report on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.reportMetrics();
      }
    });
  }

  measureTTFB() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      this.metrics.ttfb = navigation.responseStart - navigation.requestStart;
    }
  }

  observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (e) {
      console.debug('LCP observation not supported');
    }
  }

  observeFID() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'first-input') {
            this.metrics.fid = entry.processingStart - entry.startTime;
          }
        });
      });
      
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (e) {
      console.debug('FID observation not supported');
    }
  }

  observeCLS() {
    try {
      let clsValue = 0;
      
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.metrics.cls = clsValue;
          }
        });
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (e) {
      console.debug('CLS observation not supported');
    }
  }

  observeFCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
          }
        });
      });
      
      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (e) {
      console.debug('FCP observation not supported');
    }
  }

  observeLongTasks() {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.duration > 50) {
            console.debug(`Long task detected: ${Math.round(entry.duration)}ms`);
            
            // Auto-optimize if too many long tasks
            this.handlePerformanceIssue('longTask', entry.duration);
          }
        });
      });
      
      observer.observe({ entryTypes: ['longtask'] });
      this.observers.push(observer);
    } catch (e) {
      console.debug('Long task observation not supported');
    }
  }

  handlePerformanceIssue(type, value) {
    if (type === 'longTask' && value > 100) {
      // Disable expensive animations
      this.disableExpensiveAnimations();
    }
  }

  disableExpensiveAnimations() {
    if (this.animationsDisabled) return;
    this.animationsDisabled = true;

    const style = document.createElement('style');
    style.id = 'performance-override';
    style.textContent = `
      .animate-float,
      .floating-particle {
        animation: none !important;
      }
      
      .glass-card {
        backdrop-filter: none !important;
      }
      
      .modern-card:hover {
        transform: none !important;
      }
    `;
    document.head.appendChild(style);
    
    console.debug('Expensive animations disabled due to performance issues');
  }

  getPerformanceGrade() {
    const { fcp, lcp, fid, cls, ttfb } = this.metrics;
    let score = 100;

    // FCP scoring
    if (fcp > 3000) score -= 20;
    else if (fcp > 1800) score -= 10;

    // LCP scoring  
    if (lcp > 4000) score -= 30;
    else if (lcp > 2500) score -= 15;

    // FID scoring
    if (fid > 300) score -= 25;
    else if (fid > 100) score -= 10;

    // CLS scoring
    if (cls > 0.25) score -= 20;
    else if (cls > 0.1) score -= 10;

    // TTFB scoring
    if (ttfb > 800) score -= 15;
    else if (ttfb > 600) score -= 5;

    return Math.max(0, score);
  }

  reportMetrics() {
    if (!this.isSupported) return;

    const grade = this.getPerformanceGrade();
    const report = {
      ...this.metrics,
      grade,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink
      } : null
    };

    // Log to console in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.group('Performance Metrics');
      console.log('Grade:', grade + '/100');
      console.table(this.metrics);
      console.groupEnd();
    }

    // Send to analytics if available
    if (typeof gtag !== 'undefined') {
      Object.entries(this.metrics).forEach(([metric, value]) => {
        if (value !== null) {
          gtag('event', metric, {
            event_category: 'Web Vitals',
            value: Math.round(value),
            non_interaction: true
          });
        }
      });
    }

    // Custom event for external tracking
    window.dispatchEvent(new CustomEvent('performanceMetrics', {
      detail: report
    }));
  }

  // Public API for manual measurements
  measureCustomMetric(name, startTime = performance.now()) {
    return {
      end: () => {
        const duration = performance.now() - startTime;
        
        if (typeof gtag !== 'undefined') {
          gtag('event', 'timing_complete', {
            name: name,
            value: Math.round(duration)
          });
        }
        
        console.debug(`Custom metric "${name}": ${Math.round(duration)}ms`);
        return duration;
      }
    };
  }

  // Resource timing analysis
  analyzeResources() {
    const resources = performance.getEntriesByType('resource');
    const analysis = {
      total: resources.length,
      scripts: 0,
      stylesheets: 0,
      images: 0,
      totalSize: 0,
      slowResources: []
    };

    resources.forEach(resource => {
      const duration = resource.responseEnd - resource.startTime;
      
      if (resource.initiatorType === 'script') analysis.scripts++;
      if (resource.initiatorType === 'css') analysis.stylesheets++;
      if (resource.initiatorType === 'img') analysis.images++;
      
      if (resource.transferSize) {
        analysis.totalSize += resource.transferSize;
      }
      
      if (duration > 1000) {
        analysis.slowResources.push({
          name: resource.name,
          duration: Math.round(duration),
          size: resource.transferSize
        });
      }
    });

    return analysis;
  }

  destroy() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (e) {
        console.debug('Observer disconnect failed:', e);
      }
    });
    this.observers = [];
  }
}

// Performance budget configuration
const PERFORMANCE_BUDGET = {
  fcp: 1800,     // First Contentful Paint
  lcp: 2500,     // Largest Contentful Paint  
  fid: 100,      // First Input Delay
  cls: 0.1,      // Cumulative Layout Shift
  ttfb: 600      // Time to First Byte
};

// Initialize performance monitoring
let performanceMonitor;

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    performanceMonitor = new PerformanceMonitor();
    window.performanceMonitor = performanceMonitor;
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (performanceMonitor) {
      performanceMonitor.reportMetrics();
      performanceMonitor.destroy();
    }
  });
}

export { PerformanceMonitor, PERFORMANCE_BUDGET };