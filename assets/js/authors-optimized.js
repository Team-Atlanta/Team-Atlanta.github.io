(function() {
  'use strict';
  
  // Track which cards have been animated
  const animatedCards = new Set();
  
  document.addEventListener("DOMContentLoaded", function() {
    initializeTeamPage();
  });
  
  function initializeTeamPage() {
    initializeScrollEffects();
    initializeAnimations();
    initializeAccessibility();
    initializeExpandedSections();
    initializeNamePhotoHover();
  }
  
  function initializeExpandedSections() {
    const expandedSections = document.querySelectorAll('.team-section[data-expanded="true"]');
    expandedSections.forEach(section => {
      const icon = section.querySelector(".expand-icon");
      const content = section.querySelector(".team-content");
      
      if (icon) {
        icon.style.transform = "rotate(180deg)";
      }
      
      if (content) {
        // Ensure the content has proper initial state
        content.classList.remove("hidden");
        content.classList.add("expanded");
        content.style.overflow = "visible";
        content.style.opacity = "1";
        content.style.maxHeight = "none";
        content.style.paddingTop = "2rem";
        
        // Mark cards in initially expanded sections as animated
        const cards = content.querySelectorAll(".member-card");
        cards.forEach(card => {
          const cardId = getCardId(card);
          animatedCards.add(cardId);
          // Ensure cards are visible
          card.style.opacity = "1";
          card.style.transform = "translateY(0)";
        });
      }
    });
  }
  
  function getCardId(card) {
    // Create unique ID for each card based on team and name
    const teamSection = card.closest('.team-section');
    const teamName = teamSection ? teamSection.dataset.team : '';
    const memberName = card.dataset.name || '';
    return `${teamName}-${memberName}`;
  }
  
  window.toggleTeamSection = function(teamName) {
    console.log(`Attempting to toggle team: ${teamName}`);
    
    // Find the actual team section (not the anchor div)
    const section = document.querySelector(`.team-section[data-team="${teamName}"]`);
    const content = document.getElementById(`team-${teamName}-content`);
    
    console.log(`Section found:`, section);
    console.log(`Content found:`, content);
    
    // Add null checks to prevent errors
    if (!section || !content) {
      console.warn(`Team section or content not found for: ${teamName}`);
      console.log(`Available team sections:`, document.querySelectorAll('.team-section').length);
      return;
    }
    
    const overviewCard = section.querySelector(".team-overview-card");
    const expandIcon = section.querySelector(".expand-icon");
    
    console.log(`Overview card found:`, overviewCard);
    console.log(`Expand icon found:`, expandIcon);
    
    if (!overviewCard) {
      console.warn(`Overview card not found for team: ${teamName}`);
      console.log(`Section innerHTML:`, section.innerHTML.substring(0, 200));
      return;
    }
    
    // Check both data attribute and visual state to determine if truly expanded
    const dataExpanded = section.dataset.expanded === "true";
    const visuallyExpanded = content.style.opacity === "1" && 
                            content.style.maxHeight !== "0px" && 
                            !content.classList.contains("hidden");
    const isExpanded = dataExpanded && visuallyExpanded;
    
    if (isExpanded) {
      // Collapse section
      content.classList.remove("expanded");
      const currentHeight = content.getBoundingClientRect().height;
      
      content.style.overflow = "hidden";
      content.style.maxHeight = currentHeight + "px";
      content.offsetHeight; // Force reflow
      
      content.style.maxHeight = "0px";
      content.style.opacity = "0";
      content.style.paddingTop = "0px";
      
      setTimeout(() => {
        content.classList.add("hidden");
      }, 300);
      
      section.dataset.expanded = "false";
      overviewCard.setAttribute("aria-expanded", "false");
      if (expandIcon) {
        expandIcon.style.transform = "rotate(0deg)";
      }
      
    } else {
      // Expand section
      content.classList.remove("hidden");
      content.style.overflow = "hidden";
      content.style.maxHeight = "0px";
      content.style.opacity = "0";
      content.style.paddingTop = "0px";
      content.offsetHeight; // Force reflow
      
      requestAnimationFrame(() => {
        const fullHeight = content.getBoundingClientRect().height;
        const gridHeight = content.querySelector(".grid")?.getBoundingClientRect().height || 0;
        const targetHeight = Math.max(fullHeight, gridHeight) + 30;
        
        content.style.maxHeight = targetHeight + "px";
        content.style.opacity = "1";
        content.style.paddingTop = "2rem";
        
        section.dataset.expanded = "true";
        overviewCard.setAttribute("aria-expanded", "true");
        if (expandIcon) {
          expandIcon.style.transform = "rotate(180deg)";
        }
        
        // Animate only cards that haven't been animated before
        animateNewCards(content);
        
        setTimeout(() => {
          const finalHeight = content.getBoundingClientRect().height + 20;
          content.style.maxHeight = finalHeight + "px";
          content.classList.add("expanded");
        }, 400);
      });
    }
  };
  
  function animateNewCards(container) {
    const cards = container.querySelectorAll(".member-card");
    let newCardIndex = 0;
    
    cards.forEach((card) => {
      const cardId = getCardId(card);
      
      if (!animatedCards.has(cardId)) {
        // This card hasn't been animated yet
        animatedCards.add(cardId);
        
        // Faster animation with minimal delay (50ms instead of 100ms)
        setTimeout(() => {
          card.style.animation = `fadeInUp 0.3s ease-out forwards`;
        }, newCardIndex * 50);
        
        newCardIndex++;
      } else {
        // Card was already animated, ensure it's visible
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }
    });
  }
  
  window.handleKeyPress = function(event, teamName) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      window.toggleTeamSection(teamName);
    }
  };
  
  function initializeScrollEffects() {
    const backToTop = document.getElementById("back-to-top");
    if (!backToTop) return;
    
    window.addEventListener("scroll", function() {
      if (window.pageYOffset > 300) {
        backToTop.classList.remove("hidden");
      } else {
        backToTop.classList.add("hidden");
      }
    });
    
    backToTop.addEventListener("click", function() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  
  function initializeAnimations() {
    // Initial fast animation for all visible cards
    const visibleCards = document.querySelectorAll(".team-content:not(.hidden) .member-card");
    
    visibleCards.forEach((card, index) => {
      const cardId = getCardId(card);
      animatedCards.add(cardId);
      
      // Much faster initial animation (25ms delay, max 300ms total)
      const delay = Math.min(index * 25, 300);
      card.style.animationDelay = `${delay}ms`;
      card.style.animation = `fadeInUp 0.3s ease-out forwards`;
    });
    
    // Set transition for team content sections
    const teamContents = document.querySelectorAll(".team-content");
    teamContents.forEach(content => {
      content.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    });
  }
  
  function initializeAccessibility() {
    const overviewCards = document.querySelectorAll(".team-overview-card");
    overviewCards.forEach(card => {
      card.addEventListener("keydown", function(event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.click();
        }
      });
    });
    
    const memberCards = document.querySelectorAll(".member-card");
    memberCards.forEach(card => {
      card.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
          const link = this.querySelector("a");
          if (link) link.click();
        }
      });
    });
  }
  
  function initializeNamePhotoHover() {
    const memberCards = document.querySelectorAll(".member-card");
    
    memberCards.forEach(card => {
      const nameHover = card.querySelector(".name-hover");
      const photoHover = card.querySelector(".photo-hover");
      
      if (nameHover && photoHover) {
        const teamColor = nameHover.getAttribute("data-team");
        
        const addHoverClass = () => {
          nameHover.classList.add(`name-hover-${teamColor}`);
          photoHover.classList.add(`photo-hover-${teamColor}`);
        };
        
        const removeHoverClass = () => {
          nameHover.classList.remove(`name-hover-${teamColor}`);
          photoHover.classList.remove(`photo-hover-${teamColor}`);
        };
        
        nameHover.addEventListener("mouseenter", addHoverClass);
        nameHover.addEventListener("mouseleave", removeHoverClass);
        photoHover.addEventListener("mouseenter", addHoverClass);
        photoHover.addEventListener("mouseleave", removeHoverClass);
      }
    });
  }
})();