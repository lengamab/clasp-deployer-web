/**
 * AI Converter Manager
 * Handles the AI Blueprint to AppScript conversion feature
 */

class AIConverterManager {
    constructor() {
        this.initEventListeners();
        this.sparkleInterval = null;
    }

    initEventListeners() {
        // Convert Button
        const convertBtn = document.getElementById('aiConvertBtn');
        if (convertBtn) {
            convertBtn.addEventListener('click', () => this.handleConversion());
        }

        // File Upload Handling [NEW]
        const dropZone = document.getElementById('aiFileDropZone');
        const fileInput = document.getElementById('aiFileInput');
        const textarea = document.getElementById('aiBlueprintInput');

        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.handleFile(file);
            });

            // Drag and Drop
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) this.handleFile(file);
            });
        }

        // Copy Button
        const copyBtn = document.getElementById('aiCopyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyToClipboard());
        }

        // Deploy Button
        const deployBtn = document.getElementById('aiDeployBtn');
        if (deployBtn) {
            deployBtn.addEventListener('click', () => this.deployScript());
        }

        // Reset Button
        const resetBtn = document.getElementById('aiResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetView());
        }

        // Tab Switching
        const tabs = document.querySelectorAll('.tab-item[data-target^="ai"]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const group = tab.parentElement.querySelectorAll('.tab-item');
                group.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const targetId = tab.dataset.target;
                const container = document.querySelector('.ai-result-split');
                container.querySelectorAll('.result-tab-content').forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });

                const target = document.getElementById(targetId);
                if (target) {
                    target.style.display = 'block';
                    target.classList.add('active');
                }
            });
        });
    }

    handleFile(file) {
        if (!file.name.endsWith('.json')) {
            this.showError('Please upload a .json blueprint file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                JSON.parse(content); // Validate JSON
                document.getElementById('aiBlueprintInput').value = content;

                // Visual feedback
                const dropZoneSpan = document.querySelector('#aiFileDropZone span');
                if (dropZoneSpan) {
                    dropZoneSpan.innerHTML = `Loaded: <strong class="file-name">${file.name}</strong>`;
                }
            } catch (err) {
                this.showError('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    }

    async handleConversion() {
        const input = document.getElementById('aiBlueprintInput');
        const blueprint = input.value.trim();
        const platformElement = document.querySelector('input[name="aiPlatform"]:checked');
        const platform = platformElement ? platformElement.value : 'make';

        if (!blueprint) {
            this.showError('Please paste a blueprint JSON or upload a file.');
            return;
        }

        // Show Loading with Magic
        this.setLoading(true);
        this.resetResults();

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/ai/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ blueprint, platform })
            });

            const data = await response.json();

            if (data.success) {
                this.displayResults(data);
                // Switch to results tab automatically
                document.getElementById('aiResultPanel').scrollIntoView({ behavior: 'smooth' });
            } else {
                throw new Error(data.error || 'AI conversion failed. Please try again.');
            }
        } catch (error) {
            console.error('AI Conversion Error:', error);
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    displayResults(data) {
        console.log('📦 [Client] Full response data:', data);
        console.log('📦 [Client] Response keys:', Object.keys(data));
        console.log('📦 [Client] scriptCode:', data.scriptCode ? `${data.scriptCode.length} chars` : 'undefined');
        console.log('📦 [Client] code:', data.code ? `${data.code.length} chars` : 'undefined');
        console.log('📦 [Client] script:', data.script ? `${data.script.length} chars` : 'undefined');
        
        document.getElementById('aiResultPanel').style.display = 'flex';

        // Handle scriptCode - check multiple possible field names
        const codeEditor = document.getElementById('aiCodeOutput');
        if (codeEditor) {
            const code = data.scriptCode || data.code || data.script || '';
            codeEditor.value = code;
            console.log('📝 Script code loaded:', code ? `${code.length} chars` : 'empty');
            console.log('📝 Code preview:', code ? code.substring(0, 200) : 'empty');
        }

        // Handle savings
        const savingsAmount = document.getElementById('aiSavingsAmount');
        if (savingsAmount) {
            savingsAmount.textContent = data.estimatedSavings || data.savings || '$0/month';
        }

        // Handle instructions
        const instructionsDiv = document.getElementById('aiInstructionsContent');
        if (instructionsDiv) {
            const instructions = data.instructions || data.guide || '';
            instructionsDiv.innerHTML = this.parseMarkdown(instructions);
            console.log('📋 Instructions loaded:', instructions ? `${instructions.length} chars` : 'empty');
        }
    }

    setLoading(isLoading) {
        const overlay = document.getElementById('aiLoadingOverlay');
        if (!overlay) return;

        overlay.style.display = isLoading ? 'flex' : 'none';

        if (isLoading) {
            this.startSparkles();
        } else {
            this.stopSparkles();
        }
    }

    startSparkles() {
        const container = document.getElementById('aiSparkles');
        if (!container) return;

        this.sparkleInterval = setInterval(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';

            const size = Math.random() * 4 + 2;
            const left = Math.random() * 100;
            const top = Math.random() * 100;

            sparkle.style.width = `${size}px`;
            sparkle.style.height = `${size}px`;
            sparkle.style.left = `${left}%`;
            sparkle.style.top = `${top}%`;
            sparkle.style.animationDelay = `${Math.random() * 1}s`;

            container.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 1500);
        }, 150);
    }

    stopSparkles() {
        if (this.sparkleInterval) {
            clearInterval(this.sparkleInterval);
            this.sparkleInterval = null;
        }
        const container = document.getElementById('aiSparkles');
        if (container) container.innerHTML = '';
    }

    // Improved markdown parser
    parseMarkdown(text) {
        if (!text) return '<p>No instructions available.</p>';

        // Normalize line endings
        let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Escape HTML to prevent XSS (basic)
        let html = normalized
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Process code blocks first (to protect them from other replacements)
        const codeBlocks = [];
        html = html.replace(/```([\s\S]*?)```/gim, (match, code) => {
            const placeholder = `__CODEBLOCK_${codeBlocks.length}__`;
            codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
            return placeholder;
        });

        // Split into lines for better processing
        const lines = html.split('\n');
        const processedLines = [];
        let inOrderedList = false;
        let inUnorderedList = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Headers
            if (line.match(/^### /)) {
                if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
                if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
                processedLines.push(line.replace(/^### (.*)$/, '<h3>$1</h3>'));
                continue;
            }
            if (line.match(/^## /)) {
                if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
                if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
                processedLines.push(line.replace(/^## (.*)$/, '<h2>$1</h2>'));
                continue;
            }
            if (line.match(/^# /)) {
                if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
                if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
                processedLines.push(line.replace(/^# (.*)$/, '<h1>$1</h1>'));
                continue;
            }

            // Numbered lists (1. 2. 3. etc.)
            const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
            if (numberedMatch) {
                if (inUnorderedList) { processedLines.push('</ul>'); inUnorderedList = false; }
                if (!inOrderedList) { processedLines.push('<ol>'); inOrderedList = true; }
                processedLines.push(`<li>${numberedMatch[2]}</li>`);
                continue;
            }

            // Unordered lists (- or *)
            const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
            if (bulletMatch) {
                if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
                if (!inUnorderedList) { processedLines.push('<ul>'); inUnorderedList = true; }
                processedLines.push(`<li>${bulletMatch[1]}</li>`);
                continue;
            }

            // Close any open lists if we hit a non-list line
            if (inOrderedList && line.trim() !== '') { 
                processedLines.push('</ol>'); 
                inOrderedList = false; 
            }
            if (inUnorderedList && line.trim() !== '') { 
                processedLines.push('</ul>'); 
                inUnorderedList = false; 
            }

            // Empty lines become paragraph breaks
            if (line.trim() === '') {
                processedLines.push('</p><p>');
                continue;
            }

            // Regular text
            processedLines.push(line);
        }

        // Close any remaining open lists
        if (inOrderedList) processedLines.push('</ol>');
        if (inUnorderedList) processedLines.push('</ul>');

        html = processedLines.join('\n');

        // Inline formatting
        html = html
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Clean up
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<\/p>\s*<p>\s*<(h[1-3]|ul|ol)/g, '<$1');
        html = html.replace(/<\/(h[1-3]|ul|ol)>\s*<\/p>\s*<p>/g, '</$1>');
        html = html.replace(/^\s*<\/p><p>\s*/g, '');
        html = html.replace(/\s*<\/p><p>\s*$/g, '');

        // Wrap non-wrapped content in paragraphs
        if (!html.startsWith('<')) {
            html = '<p>' + html;
        }
        if (!html.endsWith('>')) {
            html = html + '</p>';
        }

        // Restore code blocks
        codeBlocks.forEach((block, i) => {
            html = html.replace(`__CODEBLOCK_${i}__`, block);
        });

        return html;
    }

    deployScript() {
        const code = document.getElementById('aiCodeOutput').value;
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
            alert('Code copied! Opening Apps Script project creator...');
            window.navigationManager.switchToPage('clasp');
        });
    }

    copyToClipboard() {
        const code = document.getElementById('aiCodeOutput').value;
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('aiCopyBtn');
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => btn.innerHTML = original, 2000);
        });
    }

    resetView() {
        document.getElementById('aiResultPanel').style.display = 'none';
        document.getElementById('aiInputPanel').style.display = 'flex';
        document.getElementById('aiBlueprintInput').value = '';
        const dropZoneSpan = document.querySelector('#aiFileDropZone span');
        if (dropZoneSpan) dropZoneSpan.innerHTML = 'Drag & Drop Blueprint JSON or <strong>Click to Upload</strong>';
    }

    resetResults() {
        const out = document.getElementById('aiCodeOutput');
        if (out) out.value = '';
        const sav = document.getElementById('aiSavingsAmount');
        if (sav) sav.textContent = '$0.00';
    }

    showError(msg) {
        // Find existing errors or create one
        alert(msg);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.aiConverter = new AIConverterManager();
});
