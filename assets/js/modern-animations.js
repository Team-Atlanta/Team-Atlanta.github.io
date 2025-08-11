/**
 * Modern Deep Blue Theme Animations
 * Enhanced UX with Smooth Interactions & Professional Effects
 */

class ModernBlueAnimations {
  constructor() {
    this.init();
  }

  init() {
    this.initScrollAnimations();
    this.initHoverEffects();
    this.initIntersectionObserver();
    this.initModernInteractions();
  }

  // Particle System for Ocean Effects
  createParticleSystem() {
    const canvas = document.createElement('canvas');
    canvas.id = 'atlantis-particles';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    canvas.style.opacity = '0.6';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    this.resizeCanvas(canvas);

    // Create floating particles (marine snow effect)
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.5 + 0.2,
        color: this.getRandomOceanColor()
      });
    }

    this.animateParticles(ctx, canvas);

    // Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas(canvas));
  }

  resizeCanvas(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  getRandomOceanColor() {
    const colors = [
      'rgba(34, 211, 238, ',
      'rgba(20, 184, 166, ',
      'rgba(0, 229, 255, ',
      'rgba(56, 189, 248, '
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  animateParticles(ctx, canvas) {
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      this.particles.forEach(particle => {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Wrap around screen
        if (particle.x > canvas.width) particle.x = -particle.size;
        if (particle.x < -particle.size) particle.x = canvas.width;
        if (particle.y > canvas.height) particle.y = -particle.size;

        // Create pulsing effect
        const pulse = Math.sin(Date.now() * 0.001 + particle.x * 0.01) * 0.3 + 0.7;
        
        // Draw particle with glow effect
        ctx.save();
        ctx.globalAlpha = particle.opacity * pulse;
        ctx.shadowBlur = 15;
        ctx.shadowColor = particle.color + '0.8)';
        ctx.fillStyle = particle.color + particle.opacity + ')';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      requestAnimationFrame(animate);
    };
    animate();
  }

  // Scroll-based Animations
  initScrollAnimations() {
    const scrollElements = document.querySelectorAll('[data-scroll-animate]');
    
    scrollElements.forEach(element => {
      element.style.opacity = '0';
      element.style.transform = 'translateY(50px)';
      element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    });

    window.addEventListener('scroll', () => {
      this.handleScrollAnimations();
      this.updateParallaxElements();
    });
  }

  handleScrollAnimations() {
    const scrollElements = document.querySelectorAll('[data-scroll-animate]');
    
    scrollElements.forEach(element => {
      const elementTop = element.getBoundingClientRect().top;
      const elementVisible = 150;
      
      if (elementTop < window.innerHeight - elementVisible) {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      }
    });
  }

  updateParallaxElements() {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    
    parallaxElements.forEach(element => {
      const speed = element.dataset.parallax || 0.5;
      const yPos = -(scrolled * speed);
      element.style.transform = `translateY(${yPos}px)`;
    });
  }

  // Modern Hover Effects
  initHoverEffects() {
    // Enhanced button effects
    const buttons = document.querySelectorAll('.btn-modern, .btn-primary');
    
    buttons.forEach(button => {
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 10px 25px rgba(30, 58, 138, 0.3)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = 'none';
      });
    });

    // Modern card hover effects
    const cards = document.querySelectorAll('.modern-card, [class*="card"]');
    
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-8px)';
        card.style.boxShadow = '0 25px 50px rgba(30, 58, 138, 0.15)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
      });
    });
  }

  // Modern Interactive Elements
  initModernInteractions() {
    // Smooth anchor scrolling
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });

    // Loading states for images
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.complete) {
        img.style.opacity = '0';
        img.addEventListener('load', function() {
          this.style.transition = 'opacity 0.3s ease';
          this.style.opacity = '1';
        });
      }
    });

    // Focus management for better accessibility
    const focusableElements = document.querySelectorAll('a, button, input, textarea, select');
    focusableElements.forEach(element => {
      element.addEventListener('focus', function() {
        this.style.outline = '2px solid #1e3a8a';
        this.style.outlineOffset = '2px';
      });
      
      element.addEventListener('blur', function() {
        this.style.outline = 'none';
      });
    });
  }

  // Typing Animation for Hero Text
  initTypingAnimation() {
    const heroTitle = document.querySelector('h1');
    if (heroTitle && heroTitle.textContent.includes('ATLANTIS')) {
      const text = heroTitle.innerHTML;
      heroTitle.innerHTML = '';
      heroTitle.classList.add('hero-title');
      
      let i = 0;
      const typeSpeed = 50;
      
      const typeWriter = () => {
        if (i < text.length) {
          heroTitle.innerHTML += text.charAt(i);
          i++;
          setTimeout(typeWriter, typeSpeed);
        } else {
          // Add pulse animation after typing
          heroTitle.style.animation = 'pulse 2s ease-in-out infinite';
        }
      };
      
      // Delay start of typing animation
      setTimeout(typeWriter, 1000);
    }
  }

  // Wave Animation Effects
  initWaveAnimations() {
    // Create SVG wave overlays for sections
    const sections = document.querySelectorAll('section');
    
    sections.forEach((section, index) => {
      if (index % 2 === 0) {
        this.addWaveOverlay(section);
      }
    });
  }

  addWaveOverlay(element) {
    const wave = document.createElement('div');
    wave.className = 'wave-overlay';
    wave.innerHTML = `
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style="width: 100%; height: 60px; position: absolute; bottom: -1px;">
        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
              fill="rgba(34, 211, 238, 0.1)" style="animation: wave 10s ease-in-out infinite;">
        </path>
      </svg>
    `;
    wave.style.position = 'absolute';
    wave.style.bottom = '0';
    wave.style.left = '0';
    wave.style.right = '0';
    wave.style.pointerEvents = 'none';
    
    element.style.position = 'relative';
    element.appendChild(wave);
  }

  // Intersection Observer for Performance
  initIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Trigger animations when elements come into view
          entry.target.classList.add('animate-in');
          
          // Add staggered animation for child elements
          const children = entry.target.querySelectorAll('[data-stagger]');
          children.forEach((child, index) => {
            setTimeout(() => {
              child.style.opacity = '1';
              child.style.transform = 'translateY(0)';
            }, index * 100);
          });
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    // Observe all sections and cards
    document.querySelectorAll('section, .card, .feature').forEach(el => {
      observer.observe(el);
    });
  }

  // Bioluminescent Trail Effect
  createBioluminescentTrail(e) {
    const trail = document.createElement('div');
    trail.className = 'bio-trail';
    trail.style.left = e.clientX + 'px';
    trail.style.top = e.clientY + 'px';
    document.body.appendChild(trail);
    
    setTimeout(() => {
      trail.remove();
    }, 1000);
  }

  // Initialize cursor trail on specific elements
  initCursorEffects() {
    const interactiveElements = document.querySelectorAll('a, button, .interactive');
    
    interactiveElements.forEach(element => {
      element.addEventListener('mousemove', (e) => {
        if (Math.random() > 0.8) { // Randomly create trails
          this.createBioluminescentTrail(e);
        }
      });
    });
  }

  // Theme transition effects
  initThemeTransitions() {
    const themeToggle = document.querySelector('[data-theme-switcher]');
    if (themeToggle) {
      themeToggle.addEventListener('change', () => {
        document.body.style.transition = 'background-color 0.5s ease, color 0.5s ease';
        
        // Add ripple effect
        const ripple = document.createElement('div');
        ripple.style.position = 'fixed';
        ripple.style.top = '0';
        ripple.style.left = '0';
        ripple.style.width = '100vw';
        ripple.style.height = '100vh';
        ripple.style.background = 'radial-gradient(circle, var(--color-bioluminescent) 0%, transparent 70%)';
        ripple.style.opacity = '0.1';
        ripple.style.pointerEvents = 'none';
        ripple.style.animation = 'ripple 1s ease-out forwards';
        document.body.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 1000);
      });
    }
  }
}

// CSS for additional animations
const additionalStyles = `
  .bio-trail {
    position: fixed;
    width: 8px;
    height: 8px;
    background: radial-gradient(circle, var(--color-bioluminescent) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
    animation: bioTrail 1s ease-out forwards;
    z-index: 9999;
  }

  @keyframes bioTrail {
    0% {
      transform: scale(0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: scale(3) rotate(180deg);
      opacity: 0;
    }
  }

  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 0.1;
    }
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  .animate-in {
    animation: fadeInUp 0.8s ease forwards;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  [data-stagger] {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const modernAnimations = new ModernBlueAnimations();
});

// Export for potential external use
window.ModernBlueAnimations = ModernBlueAnimations;