document.addEventListener('DOMContentLoaded', () => {
    // Tabs functionality
    const tabs = document.querySelectorAll('.faq-tab');
    const categories = document.querySelectorAll('.faq-category');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');

            // Hide all categories
            categories.forEach(c => c.classList.remove('active'));
            // Show target category
            const targetId = tab.getAttribute('data-category');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Accordion functionality
    const questions = document.querySelectorAll('.faq-question');

    questions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const isOpen = item.classList.contains('open');

            // Optional: Close other items (accordion behavior)
            // document.querySelectorAll('.faq-item').forEach(i => {
            //     i.classList.remove('open');
            //     i.querySelector('.faq-answer').style.maxHeight = null;
            // });

            if (!isOpen) {
                item.classList.add('open');
                const answer = item.querySelector('.faq-answer');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            } else {
                item.classList.remove('open');
                const answer = item.querySelector('.faq-answer');
                answer.style.maxHeight = null;
            }
        });
    });
});
