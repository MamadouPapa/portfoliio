
const phrases = [
  "Ingénieur DevSecOps - Spécialiste Cybersécurité",

];
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let isPausing = false;
const typingSpeed = 100;
const deleteSpeed = 50;
const pauseDuration = 2000;

function typeWriter() {
  const element = document.getElementById("typing-text");
  const currentPhrase = phrases[phraseIndex];
  
  if (!isDeleting && charIndex < currentPhrase.length) {
    // Phase d'écriture
    element.textContent = currentPhrase.substring(0, charIndex + 1);
    charIndex++;
    setTimeout(typeWriter, typingSpeed);
    
  } else if (isDeleting && charIndex > 0) {
    // Phase d'effacement
    element.textContent = currentPhrase.substring(0, charIndex - 1);
    charIndex--;
    setTimeout(typeWriter, deleteSpeed);
    
  } else if (!isPausing && charIndex === currentPhrase.length) {
    // Pause après écriture
    isDeleting = true;
    isPausing = true;
    setTimeout(() => {
      isPausing = false;
      typeWriter();
    }, pauseDuration);
    
  } else {
    // Passage à la phrase suivante
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % phrases.length;
    setTimeout(typeWriter, 500);
  }
}

// Démarration de l'animation avec le nombre de sec
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(typeWriter, 1000);
});





// mon code pour l'animation de mon menu *

            var sidemenu = document.getElementById("sidemenu");
            function openmenu(){
                sidemenu.style.right = 0;

            }
            function closemenu(){
                sidemenu.style.right="-200px";
            }




// code js pour l'animation de mes compétences / formations et expériences 
            var tablinks = document.getElementsByClassName("tab-links");
            var tabcontents = document.getElementsByClassName("tab-contents");


            function opentab(tabname){

                for(tablink of tablinks){
                tablink.classList.remove("active-link")
                }
                for(tabcontent of tabcontents){
                tabcontent.classList.remove("active-tab")
                }
                event.currentTarget.classList.add("active-link");
                document.getElementById(tabname).classList.add("active-tab");

            }




// mon code pour l'animationde mes images difilant
             let currentSlide = 0;
    const slider = document.querySelector('.slider-container');
    const totalSlides = 6;
    const slideWidth = 100 / totalSlides;
    
    document.querySelector('.slider-next').addEventListener('click', () => {
        currentSlide = (currentSlide + 1) % totalSlides;
        slider.style.transform = `translateX(-${currentSlide * slideWidth}%)`;
    });
    
    document.querySelector('.slider-prev').addEventListener('click', () => {
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        slider.style.transform = `translateX(-${currentSlide * slideWidth}%)`;
    });

    // le code pour que ça défile automatiquement
setInterval(() => {
    currentSlide = (currentSlide + 1) % totalSlides;
    slider.style.transform = `translateX(-${currentSlide * slideWidth}%)`;
}, 3000); // Change toutes les 3 secondes








// code pour la dynamisation de ma partie certifications *
document.addEventListener('DOMContentLoaded', function() {
    const carousel = document.querySelector('.certifications-carousel');
    const slides = document.querySelectorAll('.certification-slide');
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');
    const dotsContainer = document.querySelector('.carousel-dots');
    let currentIndex = 0;
    let autoSlideInterval;
    const slideDuration = 5000; // 5 secondes
    
    // Créer les indicateurs de points
    function createDots() {
        slides.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.classList.add('carousel-dot');
            if(index === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(index));
            dotsContainer.appendChild(dot);
        });
    }
    
    // Aller à un slide spécifique
    function goToSlide(index) {
        // Désactiver le slide actuel
        slides[currentIndex].classList.remove('active');
        
        // Mettre à jour l'index
        currentIndex = (index + slides.length) % slides.length;
        
        // Activer le nouveau slide
        slides[currentIndex].classList.add('active');
        updateDots();
    }
    
    // Mettre à jour les points actifs
    function updateDots() {
        const dots = document.querySelectorAll('.carousel-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }
    
    // Défilement automatique
    function startAutoSlide() {
        autoSlideInterval = setInterval(() => {
            goToSlide(currentIndex + 1);
        }, slideDuration);
    }
    
    // Arrêter le défilement automatique
    function stopAutoSlide() {
        clearInterval(autoSlideInterval);
    }
    
    // Initialisation
    createDots();
    startAutoSlide();
    
    // Événements
    nextBtn.addEventListener('click', () => {
        stopAutoSlide();
        goToSlide(currentIndex + 1);
        startAutoSlide();
    });
    
    prevBtn.addEventListener('click', () => {
        stopAutoSlide();
        goToSlide(currentIndex - 1);
        startAutoSlide();
    });
    
    // Pause au survol
    carousel.addEventListener('mouseenter', stopAutoSlide);
    carousel.addEventListener('mouseleave', startAutoSlide);
    
    // Gestion du focus de la page
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoSlide();
        } else {
            startAutoSlide();
        }
    });
});

















const scriptURL = 'https://script.google.com/macros/s/AKfycbzmeMu6fzufsTr2b4-XfoAvFa3lOHhvfX9H0aAt1ic9KV0d-B1zxImX1p_BS6tR9kHk4A/exec';
const form = document.forms['submit-to-google-sheet'];
const msg = document.getElementById('msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const response = await fetch(scriptURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Name: form.Name.value,
        Email: form.Email.value,
        Message: form.Message.value,
      }),
      // Mode 'no-cors' pour contourner les problèmes CORS
      mode: 'no-cors'
    });

    // Comme on utilise 'no-cors', on ne peut pas lire la réponse directement
    msg.innerHTML = `
  <p style="color: green; font-weight: bold;">
    Merci ${form.Name.value} !<br>
   Votre message a bien été envoyé. Vous serez contacté dans les plus brefs délais.
  </p>
`; 

    form.reset();
    setTimeout(() => msg.innerHTML = "", 3000);

  } catch (error) {
    msg.innerHTML = "Erreur : veuillez réessayer plus tard.";
    console.error("Erreur :", error);
  }
});