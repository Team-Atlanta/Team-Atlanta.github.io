// main script
(function () {
  "use strict";

  // Dropdown Menu Toggler For Mobile
  // ----------------------------------------
  const dropdownMenuToggler = document.querySelectorAll(
    ".nav-dropdown > .nav-link",
  );

  dropdownMenuToggler.forEach((toggler) => {
    toggler?.addEventListener("click", (e) => {
      e.target.closest(".nav-item").classList.toggle("active");
    });
  });

  // Testimonial Slider (only initialize if element exists)
  // ----------------------------------------
  const testimonialSlider = document.querySelector(".testimonial-slider");
  if (testimonialSlider) {
    new Swiper(".testimonial-slider", {
      spaceBetween: 24,
      loop: true,
      pagination: {
        el: ".testimonial-slider-pagination",
        type: "bullets",
        clickable: true,
      },
      breakpoints: {
        768: {
          slidesPerView: 2,
        },
        992: {
          slidesPerView: 3,
        },
      },
    });
  }

  // Fix heading anchor positioning for table of contents navigation
  // This script moves heading IDs to invisible anchor divs positioned above the headings
  // so that when users click TOC links, the actual heading remains visible
  // CRITICAL: This functionality is essential for proper TOC navigation
  // ----------------------------------------
  function fixHeadingAnchors() {
    // Find all headings with IDs in the content area
    const headings = document.querySelectorAll('.content h1[id], .content h2[id], .content h3[id], .content h4[id], .content h5[id], .content h6[id]');
    
    headings.forEach(function(heading) {
      const headingId = heading.getAttribute('id');
      if (headingId) {
        // Create invisible anchor div
        const anchorDiv = document.createElement('div');
        anchorDiv.id = headingId;
        anchorDiv.className = 'heading-anchor';
        
        // Remove ID from heading
        heading.removeAttribute('id');
        
        // Insert anchor div before the heading
        heading.parentNode.insertBefore(anchorDiv, heading);
      }
    });
  }

  // Initialize heading anchors fix
  fixHeadingAnchors();
})();