<script lang="ts">
    import {Marked} from "marked";
    import {markedHighlight} from "marked-highlight";
    import hljs from 'highlight.js';
    import 'highlight.js/styles/github-dark.css';
    import DOMPurify from "isomorphic-dompurify";
    import {onMount} from "svelte";
    import {fade, fly} from "svelte/transition";
    import {cubicOut} from "svelte/easing";

    enum Theme {
        LIGHT = 'light',
        DARK = 'dark'
    }

    enum ViewMode {
        CODE = 'code',
        FORMATTED = 'formatted',
        BOTH = 'both'
    }

    let fileName: string = '';
    let code: string = '';
    let codeLength: number = 0;
    let theme: Theme = Theme.LIGHT;
    let selectedViewMode: ViewMode = ViewMode.BOTH;
    let isFirefox: boolean;
    let socket: WebSocket;
    let dialog: HTMLDialogElement;
    let showModal: boolean = true;
    let tab: number = 0;
    let userName: string = '';
    let documentName: string = '';
    let documentId: string = '';

    onMount(() => {
        socket = new WebSocket('ws://localhost:8081');
        socket.addEventListener('open', () => {
            console.log("Connected to server");
            socket.send(`{"type": "CONNECT", "userId": "1234"}`);
        });
        socket.addEventListener('message', (event) => {
            console.log('Message from server ', event.data);
        });
        
        document.querySelector('.toggle')?.addEventListener('click', function(this: HTMLSpanElement) {
            this.classList.add('animate');
            setTimeout(() => {
                this.classList.toggle('active');
                if (theme === Theme.LIGHT) {
                    document.documentElement.classList.add('dark');
                    theme = Theme.DARK;
                } else {
                    document.documentElement.classList.remove('dark');
                    theme = Theme.LIGHT;
                }
            }, 150);
            setTimeout(() => this.classList.remove('animate'), 300);
        });
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
            theme = Theme.DARK;
            document.querySelector('.toggle')?.classList.toggle('active');
        }
        isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    });

    const onCodeUpdate = () => {
        const codeArea = document.getElementById('code-area') as HTMLTextAreaElement;
        const position = codeArea.selectionStart;
        const tmp = codeArea.value.slice(0, position).split(/\r\n|\r|\n/);
        const posX = tmp?.length || 0;
        const posY = tmp.pop()?.length || 0;

        if (codeLength > code.length) {
            console.log(`Delete, poxX: ${posX}, posY: ${posY}`);
            socket.send(`Delete, poxX: ${posX}, posY: ${posY}`);
        } else {
            const character = codeArea.value[position - 1];
            console.log(`Character: ${character}, posX: ${posX}, posY: ${posY}`);
            socket.send(`Character: ${character}, posX: ${posX}, posY: ${posY}`);
        }
        codeLength = code.length;
    }

    $: code && onCodeUpdate();

    const adjustTextareaHeight = () => {
        const codeArea = document.getElementById('code-area') as HTMLTextAreaElement;
        codeArea.style.height = 'auto';
        codeArea.style.height = codeArea.scrollHeight + (isFirefox ? 0 : 15) + 'px';
        codeArea.blur();
        codeArea.focus();
        const numbering = document.getElementById('numbering') as HTMLDivElement;
        numbering.style.height = 'auto';
        numbering.style.height = codeArea.scrollHeight + (isFirefox ? 0 : 15) + 'px';
    }

    const marked = new Marked(
            markedHighlight({
                langPrefix: 'hljs language-',
                highlight(code, lang) {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    return hljs.highlight(code, { language }).value;
                }
            })
    );

    const renderer = new marked.Renderer();

    renderer.code = (code, language) => {
        return `
            <div class="flex flex-col my-4">
                <div class="flex justify-between bg-gray-700 dark:bg-gray-800 rounded-t-lg select-none text-white text-xs py-2">
                    <span class="px-4">${language}</span>
                    <div class="flex mx-2 py-1 items-center space-x-2">
                        <div class="w-2 h-2 rounded-full bg-green-400"></div>
                        <div class="w-2 h-2 rounded-full bg-amber-400"></div>
                        <div class="w-2 h-2 rounded-full bg-red-400"></div>
                    </div>
                </div>
                <pre><code class="hljs language-${language} bg-gray-800 dark:bg-gray-950 rounded-b-lg">${code}</code></pre>
            </div>
        `;
    };

    marked.use({ renderer });
    $: html = DOMPurify.sanitize(marked.parse(code) as string);
    $: nbOfLines = code.split(/\r\n|\r|\n/).length;
    $: nbOfWords = code.split(/\S+/g).length - 1;
    $: nbOfChars = code.length;

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
            if (!element.files) return;
            const file = element.files[0];
            fileName = file.name.split('.').slice(0, -1).join('.');
            const reader = new FileReader();
            reader.onload = () => {
                code = reader.result as string;
            }
            reader.readAsText(file);
        }
        element.click();
        //TODO: adjust textarea height after upload
    }

    const createDocument = async (docName: string, userName: string) => {
        const response = await fetch(`http://localhost:8080/create?docName=${docName}&userName=${userName}`, {method: 'POST'});
        const data = await response.json();
        console.log(data);
    }

    const joinDocument = async (docId: string, userName: string) => {
        const response = await fetch(`http://localhost:8080/join?docId=${docId}&userName=${userName}`, {method: 'POST'});
        const data = await response.json();
        console.log(data);
    }

    let userNamePlaceholder: string = 'User Name';
    let documentNamePlaceholder: string = 'Document title';
    let documentIdPlaceholder: string = 'Document ID';

    const onConfirm = () => {
        if (tab === 0) {
            if (!userName || !documentName) {
                if (!userName) userNamePlaceholder = 'Please enter a user name';
                if (!documentName) documentNamePlaceholder = 'Please enter a document title';
                return;
            }
            createDocument(documentName, userName);
        } else {
            if (!userName || !documentId) {
                if (!userName) userNamePlaceholder = 'Please enter a user name';
                if (!documentId) documentIdPlaceholder = 'Please enter a document ID';
                return;
            }
            joinDocument(documentId, userName);
        }
        showModal = false;
    }
</script>

<main class="h-screen w-screen flex flex-col bg-amber-700 overflow-hidden">
    {#if showModal}
        <div class="fixed inset-0 z-20 backdrop-blur-[2px] backdrop-brightness-75" out:fade={{duration: 250}}></div>
        <dialog open bind:this={dialog} class="top-1/3 rounded-lg z-50 bg-transparent shadow-lg" out:fly={{ y: -20, easing: cubicOut, opacity: 0, duration: 250 }}>
            <div class="flex p-2 bg-blue-200 dark:bg-slate-800 rounded-t border-t border-blue-400 dark:border-blue-950 border-x space-x-2">
                <button class="p-4 rounded-lg border {tab===0 ? 'bg-blue-100 dark:bg-slate-700 text-blue-800 dark:text-blue-300 border-blue-400 dark:border-blue-950 animate-translate-bottom-with-bounce' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:dark:text-white border-transparent animate-translate-top'}" on:click={() => tab=0}>New document</button>
                <button class="p-4 rounded-lg border {tab===1 ? 'bg-blue-100 dark:bg-slate-700 text-blue-800 dark:text-blue-300 border-blue-400 dark:border-blue-950 animate-translate-bottom-with-bounce' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:dark:text-white border-transparent animate-translate-top'}" on:click={() => tab=1}>Join document</button>
            </div>
            <div class="flex flex-col h-64 p-2 bg-blue-100 dark:bg-slate-700 rounded-b-lg border border-blue-400 dark:border-blue-950 justify-between">
                <div class="flex flex-col space-y-2">
                    <input class="w-full p-1 bg-blue-50 dark:bg-slate-700 rounded-lg border border-blue-400 dark:border-blue-950 dark:text-white outline-none focus:ring-1 focus:ring-blue-400 focus:dark:ring-blue-700 z-50 transition-all duration-150 {userNamePlaceholder==='User Name' ? 'dark:placeholder-white' : 'placeholder-red-500'}" placeholder={userNamePlaceholder} bind:value={userName}/>
                    {#if tab===0}
                        <input class="w-full p-1 bg-blue-50 dark:bg-slate-700 rounded-lg border border-blue-400 dark:border-blue-950 dark:text-white outline-none focus:ring-1 focus:ring-blue-400 focus:dark:ring-blue-700 z-50 transition-all duration-150 {documentNamePlaceholder==='Document title' ? 'dark:placeholder-white' : 'placeholder-red-500'}" placeholder={documentNamePlaceholder} bind:value={documentName}/>
                    {:else}
                        <input class="w-full p-1 bg-blue-50 dark:bg-slate-700 rounded-lg border border-blue-400 dark:border-blue-950 dark:text-white outline-none focus:ring-1 focus:ring-blue-400 focus:dark:ring-blue-700 z-50 transition-all duration-150 {documentIdPlaceholder==='Document ID' ? 'dark:placeholder-white' : 'placeholder-red-500'}" placeholder={documentIdPlaceholder} bind:value={documentId}/>
                    {/if}
                </div>
                <div class="flex w-full justify-center">
                    <button class="flex gap-1 py-1 px-2 bg-green-400 dark:bg-green-700 text-gray-700 dark:text-white rounded-lg font-medium shadow-lg hover:opacity-80 active:scale-95 select-none" on:click={onConfirm}>
                        Confirm
                        <svg class="fill-gray-700 dark:fill-white h-6" viewBox="0 0 24 24" height="48px"><path d="M 19.28125 5.28125 L 9 15.5625 L 4.71875 11.28125 L 3.28125 12.71875 L 8.28125 17.71875 L 9 18.40625 L 9.71875 17.71875 L 20.71875 6.71875 Z"/></svg>
                    </button>
                </div>
            </div>
        </dialog>
    {/if}

    <div class="flex py-6 px-2 h-8 items-center justify-between bg-blue-200 dark:bg-slate-800 border-t border-b border-gray-300 dark:border-gray-600">
        <div class="flex">
            <input class="p-1 bg-blue-50 dark:bg-slate-700 rounded-l-lg border border-slate-400 dark:border-gray-600 dark:placeholder-white dark:text-white outline-none focus:ring-1 focus:ring-blue-400 focus:dark:ring-blue-700 z-10 transition-all duration-150" placeholder="File name" bind:value={fileName} />
            <p class="p-1 bg-blue-100 dark:bg-gray-800 rounded-r-lg border-y border-r border-slate-400 dark:border-gray-600 dark:text-white select-none">.md</p>
        </div>
        <div class="flex h-full items-center space-x-2">
            <div class="group relative flex justify-center whitespace-nowrap py-1 px-3 dark:text-white bg-blue-100 dark:bg-slate-700 rounded-lg border border-slate-400 dark:border-gray-600">
                <p class="font-semibold text-lg select-none">i</p>
                <div class="group-hover:block hidden absolute top-8 p-2 bg-blue-100 dark:bg-slate-600 rounded-lg border border-gray-300 dark:border-gray-500">
                    <p class="">Number of words: {nbOfWords}</p>
                    <p class="">Number of characters: {nbOfChars}</p>
                </div>
            </div>
            <span class="toggle dark:text-white flex items-center justify-center"></span>
            <div class="flex p-1 space-x-2 bg-blue-100 dark:bg-slate-700 rounded-lg border border-slate-400 dark:border-gray-600">
                <button class="hover:bg-red-500 p-0.5 bg-opacity-30 hover:bg-opacity-30 rounded-full transition-all duration-100 active:scale-90 {selectedViewMode===ViewMode.CODE && 'bg-red-500'}" on:click={() => {selectedViewMode=ViewMode.CODE}}>
                    <svg class="fill-red-500 h-6 select-none" viewBox="0 0 16 16"><path d="m10.043 2.05-5.004 11.5.922.4 4.996-11.5ZM3.227 5.07.997 8l2.23 2.926.796-.602L2.253 8l1.77-2.32Zm9.546 0-.796.61L13.747 8l-1.77 2.324.796.602L15.003 8Z"/></svg>
                </button>
                <button class="hover:bg-yellow-500 p-0.5 bg-opacity-30 hover:bg-opacity-30 rounded-full transition-all duration-100 active:scale-90 {selectedViewMode===ViewMode.BOTH && 'bg-yellow-500'}" on:click={() => {selectedViewMode=ViewMode.BOTH}}>
                    <svg class="fill-yellow-500 h-6 select-none" viewBox="0 0 16 16"><path d="M2.5 2C1.677 2 1 2.677 1 3.5V9h1V5h12v7.5c0 .281-.219.5-.5.5H12v1h1.5c.823 0 1.5-.677 1.5-1.5v-9c0-.823-.677-1.5-1.5-1.5h-11zm0 1h11c.281 0 .5.219.5.5V4H2v-.5c0-.281.219-.5.5-.5zm3.477 6L4.89 14h1.023L7 9H5.977zm-2.456.045L1.066 11.5l2.455 2.455.708-.707L2.48 11.5 4.23 9.752l-.708-.707zm4.981 0-.707.707L9.543 11.5l-1.748 1.748.707.707 2.455-2.455-2.455-2.455z"/></svg>
                </button>
                <button class="hover:bg-green-500 p-0.5 bg-opacity-30 hover:bg-opacity-30 rounded-full transition-all duration-100 active:scale-90 {selectedViewMode===ViewMode.FORMATTED && 'bg-green-500'}" on:click={() => {selectedViewMode=ViewMode.FORMATTED}}>
                    <svg class="fill-green-500 h-6 select-none" viewBox="0 0 16 16"><path d="M2.5 2C1.677 2 1 2.677 1 3.5v9c0 .823.677 1.5 1.5 1.5h11c.823 0 1.5-.677 1.5-1.5v-9c0-.823-.677-1.5-1.5-1.5h-11zm0 1h11c.281 0 .5.219.5.5V4H2v-.5c0-.281.219-.5.5-.5zM2 5h12v7.5c0 .281-.219.5-.5.5h-11a.493.493 0 0 1-.5-.5V5zm1.5 2a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5h-3zM8 7v1h5V7H8zM4 8h2v3H4V8zm4 1v1h5V9H8zm0 2v1h5v-1H8z"/></svg>
                </button>
            </div>
            <button class="hover:bg-blue-50 p-1 bg-blue-100 dark:bg-slate-700 dark:fill-slate-300 border rounded-lg active:scale-90 border-slate-400 dark:border-gray-600 transition-all duration-100" on:click={uploadCode}>
                <svg class="h-7 select-none" viewBox="0 0 16 16"><path d="M7.5 1.793 3.648 5.648l.704.704L7 3.707V11h1V3.707l2.645 2.645.71-.704ZM3 13v1h9v-1Z"/></svg>
            </button>
            <button class="hover:bg-blue-50 p-1 bg-blue-100 dark:bg-slate-700 dark:fill-slate-300 border rounded-lg active:scale-90 border-slate-400 dark:border-gray-600 transition-all duration-100" on:click={downloadCode}>
                <svg class="h-7 select-none" viewBox="0 0 16 16"><path d="M7 2v7.293L4.352 6.648l-.704.704L7.5 11.207l3.855-3.855-.71-.704L8 9.293V2ZM3 13v1h9v-1Z"/></svg>
            </button>
        </div>
    </div>
    <div class="flex h-[95vh] w-full bg-blue-400 dark:[color-scheme:dark]">
        <div class="flex h-full overflow-y-auto {selectedViewMode===ViewMode.CODE ? 'w-full': 'w-1/2'} {selectedViewMode===ViewMode.FORMATTED && 'hidden'}" id="code-container">
            <div class="flex flex-col min-h-[100%] w-8 bg-blue-50 dark:bg-slate-700 dark:text-white font-semibold select-none" id="numbering">
                {#each Array(nbOfLines) as n, index (index)}
                    <span class="text-right pr-1">{index + 1}</span>
                {/each}
            </div>
            <textarea wrap='off' bind:value={code} on:keyup={adjustTextareaHeight} class="flex-1 px-0.5 resize-none outline-none dark:bg-slate-600 dark:text-white overflow-y-hidden overflow-x-scroll" id="code-area"/>
        </div>
        <div class="flex flex-col bg-blue-50 dark:bg-slate-700 h-full dark:text-white px-2 pb-2 overflow-auto {selectedViewMode===ViewMode.FORMATTED ? 'w-full': 'w-1/2'} {selectedViewMode===ViewMode.CODE && 'hidden'}">
            {@html html}
        </div>
    </div>
</main>

<style>
    .toggle {
        cursor: pointer;
        font-size: 150%;
    }

    .toggle:before {
        content: '☀️';
    }

    .toggle.active:before {
        content: '🌒';
    }

    .toggle.animate {
        animation: animate .3s cubic-bezier(0.4, 0.0, 0.2, 1);
    }
    @keyframes animate {
        0%   { transform: scale(1); }
        50%  { transform: scale(0); }
        100% { transform: scale(1); }
    }
</style>