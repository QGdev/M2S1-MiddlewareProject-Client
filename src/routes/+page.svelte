<script lang="ts">
	import {Marked} from "marked";
	import {markedHighlight} from "marked-highlight";
	import hljs from 'highlight.js';
	import DOMPurify, { sanitize, isSupported } from "isomorphic-dompurify";
	import settingsIcon from "$lib/assets/settings.svg";
	import downloadIcon from "$lib/assets/download.svg";
    import uploadIcon from "$lib/assets/upload.svg";
	import {onMount} from "svelte";

	let fileName = '';
	let code: string = '';

	onMount(() => {
		const codeElement = document.getElementById('codeBlock') as HTMLTextAreaElement;
		codeElement.addEventListener('input', () => {
			code = codeElement.value;
		});
	});

	const marked = new Marked(
		markedHighlight({
			langPrefix: 'hljs language-',
			highlight(code, lang) {
				const language = hljs.getLanguage(lang) ? lang : 'plaintext';
				return hljs.highlight(code, { language }).value;
			}
		})
    );
	$: html = marked.parse(code);
	$: nbOfLines = code.split(/\r\n|\r|\n/).length;

    const downloadCode = () => {
        const element = document.createElement('a');
        const file = new Blob([code], {type: 'text/markdown'});
        element.href = URL.createObjectURL(file);
        element.download = fileName ? `${fileName}.md` : 'file.md';
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
    }

	const uploadCode = () => {
        const element = document.createElement('input');
        element.type = 'file';
        element.accept = '.md';
        element.onchange = () => {
            const file = element.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                code = reader.result as string;
            }
            reader.readAsText(file);
        }
        element.click();
    }
</script>

<main class="h-screen w-screen flex flex-col flex-grow">
    <div class="flex p-6 h-8 items-center justify-between bg-blue-200">
        <input class="p-1 rounded bg-blue-50" placeholder="File name" bind:value={fileName} />
        <div class="flex h-full items-center space-x-2">
            <button class="hover:bg-blue-50 bg-blue-100 border rounded active:scale-90 border-blue-400 transition-all duration-100" on:click={uploadCode}>
                <img src={uploadIcon} class="h-8 select-none" alt="settings icon"/>
            </button>
            <button class="hover:bg-blue-50 bg-blue-100 border rounded active:scale-90 border-blue-400 transition-all duration-100" on:click={downloadCode}>
                <img src={downloadIcon} class="h-8 select-none" alt="settings icon"/>
            </button>
            <button>
                <img src={settingsIcon} class="h-14 select-none" alt="settings icon"/>
            </button>
        </div>
    </div>
    <div class="flex h-full w-full bg-blue-400">
        <div class="h-full w-8 bg-blue-50">
            <div class="w-full select-none">
                {#each Array(nbOfLines) as n, index (index)}
                    <div class="text-right px-2">{index + 1}</div>
                {/each}
            </div>
        </div>
        <div class="flex items-stretch h-full w-full">
            <div class="h-full w-1/2 bg-blue-100 overflow-auto resize-x">
                <textarea bind:value={code} class="h-full w-full resize-none outline-none whitespace-nowrap" id="codeBlock"/>
            </div>
            <div class="flex flex-grow bg-blue-100 h-full">
                <div>
                    {@html html}
                </div>
            </div>
        </div>
    </div>
</main>