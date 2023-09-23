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

	let selectedViewMode = 'both';

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
            <div class="flex p-1 space-x-2 bg-slate-300 rounded-lg border border-slate-400">
                <button class="hover:bg-red-500 p-1 bg-opacity-30 hover:bg-opacity-30 rounded-full transition-all duration-100 {selectedViewMode==='code' && 'bg-red-500'}" on:click={() => {selectedViewMode="code"}}>
                    <svg class="fill-red-500 h-6 select-none" viewBox="0 0 16 16"><path d="m10.043 2.05-5.004 11.5.922.4 4.996-11.5ZM3.227 5.07.997 8l2.23 2.926.796-.602L2.253 8l1.77-2.32Zm9.546 0-.796.61L13.747 8l-1.77 2.324.796.602L15.003 8Z"/></svg>
                </button>
                <button class="hover:bg-yellow-500 p-1 bg-opacity-30 hover:bg-opacity-30 rounded-full transition-all duration-100 {selectedViewMode==='both' && 'bg-yellow-500'}" on:click={() => {selectedViewMode="both"}}>
                    <svg class="fill-yellow-500 h-6 select-none" viewBox="0 0 16 16"><path d="M2.5 2C1.677 2 1 2.677 1 3.5V9h1V5h12v7.5c0 .281-.219.5-.5.5H12v1h1.5c.823 0 1.5-.677 1.5-1.5v-9c0-.823-.677-1.5-1.5-1.5h-11zm0 1h11c.281 0 .5.219.5.5V4H2v-.5c0-.281.219-.5.5-.5zm3.477 6L4.89 14h1.023L7 9H5.977zm-2.456.045L1.066 11.5l2.455 2.455.708-.707L2.48 11.5 4.23 9.752l-.708-.707zm4.981 0-.707.707L9.543 11.5l-1.748 1.748.707.707 2.455-2.455-2.455-2.455z"/></svg>
                </button>
                <button class="hover:bg-green-500 p-1 bg-opacity-30 hover:bg-opacity-30 rounded-full transition-all duration-100 {selectedViewMode==='formatted' && 'bg-green-500'}" on:click={() => {selectedViewMode="formatted"}}>
                    <svg class="fill-green-500 h-6 select-none" viewBox="0 0 16 16"><path d="M2.5 2C1.677 2 1 2.677 1 3.5v9c0 .823.677 1.5 1.5 1.5h11c.823 0 1.5-.677 1.5-1.5v-9c0-.823-.677-1.5-1.5-1.5h-11zm0 1h11c.281 0 .5.219.5.5V4H2v-.5c0-.281.219-.5.5-.5zM2 5h12v7.5c0 .281-.219.5-.5.5h-11a.493.493 0 0 1-.5-.5V5zm1.5 2a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5h-3zM8 7v1h5V7H8zM4 8h2v3H4V8zm4 1v1h5V9H8zm0 2v1h5v-1H8z"/></svg>
                </button>
            </div>
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
        <div class="h-full w-8 bg-blue-50 {selectedViewMode==='formatted' && 'hidden'}">
            <div class="w-full select-none">
                {#each Array(nbOfLines) as n, index (index)}
                    <div class="text-right px-2">{index + 1}</div>
                {/each}
            </div>
        </div>
        <div class="flex items-stretch h-full w-full">
            <div class="h-full  bg-blue-100 overflow-auto resize-x {selectedViewMode==='formatted' && 'hidden'} {selectedViewMode==='code' ? 'w-full': 'w-1/2'}">
                <textarea bind:value={code} class="h-full w-full resize-none outline-none whitespace-nowrap" id="codeBlock"/>
            </div>
            <div class="flex flex-grow bg-blue-100 h-full {selectedViewMode==='code' && 'hidden'}">
                <div>
                    {@html html}
                </div>
            </div>
        </div>
    </div>
</main>