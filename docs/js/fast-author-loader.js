(function() {
  'use strict';
  
  window.FastAuthorLoader = {
    init() {
      this.optimizeImageLoading();
      this.setupIntersectionObserver();
      this.preconnectToExternalDomains();
    },
    
    preconnectToExternalDomains() {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = 'https://www.gravatar.com';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    },
    
    optimizeImageLoading() {
      const images = document.querySelectorAll('.author-img');
      const loadQueue = [];
      const MAX_CONCURRENT = 6;
      let loading = 0;
      
      const loadImage = (img) => {
        return new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          
          loading++;
          const tempImg = new Image();
          
          tempImg.onload = () => {
            loading--;
            img.classList.add('loaded');
            resolve();
            processQueue();
          };
          
          tempImg.onerror = () => {
            loading--;
            resolve();
            processQueue();
          };
          
          if (img.dataset.src) {
            tempImg.src = img.dataset.src;
            img.src = img.dataset.src;
          } else {
            tempImg.src = img.src;
          }
        });
      };
      
      const processQueue = () => {
        while (loading < MAX_CONCURRENT && loadQueue.length > 0) {
          const img = loadQueue.shift();
          loadImage(img);
        }
      };
      
      images.forEach((img, index) => {
        if (index < MAX_CONCURRENT) {
          loadImage(img);
        } else {
          loadQueue.push(img);
        }
      });
      
      processQueue();
    },
    
    setupIntersectionObserver() {
      if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.author-card-fast').forEach(card => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
        return;
      }
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const card = entry.target;
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
            observer.unobserve(card);
          }
        });
      }, {
        rootMargin: '100px',
        threshold: 0
      });
      
      document.querySelectorAll('.author-card-fast').forEach(card => {
        observer.observe(card);
      });
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.FastAuthorLoader.init();
    });
  } else {
    window.FastAuthorLoader.init();
  }
})();