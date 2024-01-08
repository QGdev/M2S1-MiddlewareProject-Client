<script lang="ts">
    import {Marked} from "marked";
    import {markedHighlight} from "marked-highlight";
    import hljs from 'highlight.js';
    import 'highlight.js/styles/github-dark.css';
    import DOMPurify from "isomorphic-dompurify";
    import {onDestroy, onMount} from "svelte";
    import {fade, fly} from "svelte/transition";
    import {cubicOut} from "svelte/easing";
    import {SvelteToast, toast} from "@zerodevx/svelte-toast";
    import type {
        ChangeDocNameMessage,
        ConnectMessage,
        DeleteCharMessage,
        DeleteLineBreakMessage,
        DocumentOperationAnswer,
        InsertCharMessage,
        InsertLineBreakMessage,
        User,
    } from "../types";
    import IconBadge from "./IconBadge.svelte";
    import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';

    let apiUrl: string;

    enum Theme {
        LIGHT = 'light',
        DARK = 'dark'
    }

    enum ViewMode {
        CODE = 'code',
        FORMATTED = 'formatted',
        BOTH = 'both'
    }

    let code: string = '';
    let oldCode: string = '';
    let theme: Theme = Theme.LIGHT;
    let selectedViewMode: ViewMode = ViewMode.BOTH;
    let socket: WebSocket;
    let showModal: boolean = true;
    let tab: number = 0;
    let userNameForm: string = '';
    let documentNameForm: string = '';
    let documentIdForm: string = '';
    let documentAnswer: DocumentOperationAnswer;
    let docNameInput: HTMLInputElement;
    let docName: string = '';
    let oldDocName: string = '';
    let connectedUser: User[] = [];

    let editor: Monaco.editor.IStandaloneCodeEditor;
    let monaco: typeof Monaco;
    let editorContainer: HTMLElement;

    onMount(async () => {
        monaco = (await import('./monaco')).default;

        monaco.editor.defineTheme('dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#475569',
                'editorGutter.background': '#475569',
                'editor.lineHighlightBackground': '#3a465a',
                'editor.lineHighlightBorder': '#334155',
            }
        })

        // Monaco Editor settings
        editor = monaco.editor.create(editorContainer, {
            language: 'markdown',
            theme: theme === Theme.LIGHT ? 'vs' : 'dark',
            automaticLayout: true,
            fontFamily: 'JetBrains Mono',
            lineNumbersMinChars: 3,
            wordWrap: 'on' as const,
            wordWrapColumn: 80,
            scrollBeyondLastLine: false,
            fixedOverflowWidgets: true,
            quickSuggestions: false,
            tabSize: 1,
            autoIndent: 'none',
            trimAutoWhitespace: false,
            minimap: {
                enabled: false,
            },
        });

        // Disable default completion panel
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {});

        code = editor.getValue();

        // call onCodeUpdate when the user types
        editor.onDidChangeModelContent(e => {
            if (e.isFlush) return;
            else onCodeUpdate();
        });
    });

    onDestroy(() => {
        monaco?.editor.getModels().forEach((model) => model.dispose());
        editor?.dispose();
    });

    /**
     * Function called at the start of the application.
     */
    onMount(() => {
        //  Detect if we are in production or development mode
        if (process.env.NODE_ENV === 'production') {
            apiUrl = `${window.location.hostname}:${window.location.port}`;
        } else {
            console.log('Development mode detected');
            apiUrl = `${window.location.hostname}:8080`;
        }

        // Connect to the WebSocket server
        socket = new WebSocket(`ws://${apiUrl}/ws`);
        socket.addEventListener('open', () => {
            toast.push('Connected to server');
        });
        socket.addEventListener('close', () => {
            toast.push('Disconnected from server', {classes: ['error']});
        });

        // Listen to server messages
        socket.addEventListener('message', (event) => {
            console.log('Message from server ', JSON.parse(event.data));
            const messageJson = JSON.parse(event.data);

            // Update the list of connected users when a user join or leave the document
            if (messageJson.type==='CONNECT' && messageJson.userName) {
                connectedUser = messageJson.users;
            }

            if (messageJson.type==='DISCONNECT') {
                toast.push(`${connectedUser.find((user: User) => user.userId === messageJson.userId)?.userName} left the document`);
                connectedUser = connectedUser.filter((user: User) => user.userId !== messageJson.userId);
            }

            // If the document name is evaluated as invalid by the server, we reset the document name to the previous one
            if (messageJson.type==='ERROR' && messageJson.message==='New document name is not valid') {
                docName = oldDocName;
                toast.push('New document name is not valid', {classes: ['error']});
                return;
            }

            // For the joining user, we update the document name and the code
            if (messageJson.userId === documentAnswer.user.id && messageJson.type==='CONNECT' && messageJson.docName && messageJson.content) {
                docName = messageJson.docName;
                code = messageJson.content;
                oldCode = code;
                editor.setValue(code);
                return;
            }

            // For other users, we update the code according to the action performed by the user
            if (messageJson.userId !== documentAnswer.user.id) {
                if (messageJson.type==='CONNECT') {
                    toast.push(`${messageJson.userName} joined the document`);
                    return;
                } else if (messageJson.type==='CHANGE_DOC_NAME') {
                    docName = messageJson.newName;
                    return;
                }

                const codeSplit = code.split(/\r\n|\r|\n/);
                let index: number = 0;
                for (let i=0; i<messageJson.lineIdx; i++) {
                    index += codeSplit[i].length + 1;
                }
                if (messageJson.type!=='DELETE_LINE_BRK') index += messageJson.columnIdx;

                // To update the code, we simply slice the string at the right position and insert/delete the character/line break
                if (messageJson.type==='INSERT_CHAR') {
                    code = code.slice(0, index) + messageJson.char + code.slice(index);
                } else if (messageJson.type==='DELETE_CHAR') {
                    code = code.slice(0, index) + code.slice(index + 1);
                } else if (messageJson.type==='DELETE_LINE_BRK') {
                    code = code.slice(0, index-1) + code.slice(index);
                } else if (messageJson.type==='INSERT_LINE_BRK') {
                    code = code.slice(0, index) + '\n' + code.slice(index);
                }
                oldCode = code;
                const cursorPosition = editor.getPosition();
                editor.setValue(code);
                editor.setPosition(cursorPosition || {lineNumber: 1, column: 1});
            }
        });

        docNameInput = document.getElementById('doc-name-input') as HTMLInputElement;
        docNameInput.addEventListener('blur', onDocNameInputBlur);
        
        document.querySelector('.toggle')?.addEventListener('click', function(this: HTMLSpanElement) {
            this.classList.add('animate');
            setTimeout(() => {
                this.classList.toggle('active');
                if (theme === Theme.LIGHT) {
                    document.documentElement.classList.add('dark');
                    editor.updateOptions({theme: 'dark'});
                    theme = Theme.DARK;
                } else {
                    document.documentElement.classList.remove('dark');
                    editor.updateOptions({theme: 'vs'});
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
    });

    /**
     * Send a message to the server through the WebSocket connection.
     * @param messageData The message to send.
     */
    const sendMessage = (messageData: ConnectMessage|InsertCharMessage|InsertLineBreakMessage|DeleteLineBreakMessage|DeleteCharMessage|ChangeDocNameMessage) => {
        socket.send(JSON.stringify(messageData));
        socket.onerror = (error) => {
            console.error(`[error] ${error.message}`);
        };
    }

    /**
     * Function called each time the user types in the editor.
     * Determine the action performed by the user and send the corresponding message to the server.
     */
    const onCodeUpdate = () => {
        code = editor.getValue();
        const position = editor.getPosition();
        const posX = position?.lineNumber ? position.lineNumber - 1 : 0;
        const posY = position?.column ? position.column - 1 : 0;

        if (oldCode.length > code.length) {
            if (oldCode.split(/\r\n|\r|\n/).length > code.split(/\r\n|\r|\n/).length) {
                sendMessage({type: 'DELETE_LINE_BRK', lineIdx: posX + 1, userId: documentAnswer.user.id});
            } else {
                sendMessage({type: 'DELETE_CHAR', lineIdx: posX, columnIdx: posY, userId: documentAnswer.user.id});
            }
        } else if (oldCode.length < code.length) {
            if (posY === 0) {
                sendMessage({type: 'INSERT_LINE_BRK', lineIdx: posX - 1, columnIdx: code.split(/\r\n|\r|\n/)[posX - 1].length, userId: documentAnswer.user.id});
            } else {
                const character = editor.getModel()?.getValueInRange({
                    startLineNumber: posX + 1,
                    startColumn: posY,
                    endLineNumber: posX + 1,
                    endColumn: posY + 1,
                }) || '';
                sendMessage({type: 'INSERT_CHAR', lineIdx: posX, columnIdx: posY - 1, char: character, userId: documentAnswer.user.id});
            }
        } else return;
        oldCode = code;
    }

    const toastOptions = {
        pausable: true,
    };

    /**
     * Markdown parser, using Marked and Highlight.js.
     */
    const marked = new Marked(
            markedHighlight({
                langPrefix: 'hljs language-',
                highlight(code, lang) {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    return hljs.highlight(code, { language }).value;
                }
            })
    );

    /**
     * Custom renderer for the Markdown parser.
     * Used to add a custom window to the code blocks.
     */
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
    $: nbOfWords = code.split(/\S+/g).length - 1;
    $: nbOfChars = code.length;

    /**
     * Download the Markdown code as a file.
     */
    const downloadCode = () => {
        const element = document.createElement('a');
        const file = new Blob([code], {type: 'text/markdown'});
        element.href = URL.createObjectURL(file);
        element.download = docNameInput.value ? `${docNameInput.value}.md` : 'file.md';
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
    }

    /**
     * Change the document name when the user click outside the input.
     */
    const onDocNameInputBlur = () => {
        if (!documentNameForm) documentNamePlaceholder = 'Please enter a document title';
        const messageData: ChangeDocNameMessage = {
            type: 'CHANGE_DOC_NAME',
            newName: docName,
            userId: documentAnswer.user.id,
        }

        sendMessage(messageData);
    }

    /**
     * Fetch the API to create a new document.
     * @param docName The name of the document.
     * @param userName The name of the user.
     */
    const createDocument = async (docName: string, userName: string): Promise<DocumentOperationAnswer> => {
        const response = await fetch(`http://${apiUrl}/api/create?docName=${docName}&userName=${userName}`, {method: 'POST'});
        return await response.json() as DocumentOperationAnswer;
    }

    /**
     * Fetch the API to join an existing document.
     * @param docId The id of the document.
     * @param userName The name of the user.
     */
    const joinDocument = async (docId: string, userName: string): Promise<DocumentOperationAnswer> => {
        const response = await fetch(`http://${apiUrl}/api/join?docId=${docId}&userName=${userName}`, {method: 'POST'});
        return await response.json() as DocumentOperationAnswer;
    }

    let userNamePlaceholder: string = 'User Name';
    let documentNamePlaceholder: string = 'Document title';
    let documentIdPlaceholder: string = 'Document ID';

    /**
     * Actions to perform when the user close the connection modal.
     */
    const onConfirm = () => {
        if (tab === 0) {
            if (!userNameForm || !documentNameForm) {
                if (!userNameForm) userNamePlaceholder = 'Please enter a user name';
                if (!documentNameForm) documentNamePlaceholder = 'Please enter a document title';
                return;
            }
            createDocument(documentNameForm, userNameForm).then((data) => {
                documentAnswer = data;
                docName = documentAnswer.document.name;
                code = documentAnswer.document.content;
                oldCode = code;
                editor.setValue(code);
                sendMessage({type: 'CONNECT', userId: documentAnswer.user.id, docId: documentAnswer.document.id});
            });
        } else {
            if (!userNameForm || !documentIdForm) {
                if (!userNameForm) userNamePlaceholder = 'Please enter a user name';
                if (!documentIdForm) documentIdPlaceholder = 'Please enter a document ID';
                return;
            }
            joinDocument(documentIdForm, userNameForm).then((data) => {
                documentAnswer = data;
                docName = documentAnswer.document.name;
                code = documentAnswer.document.content;
                oldCode = code;
                editor.setValue(code);
                sendMessage({type: 'CONNECT', userId: documentAnswer.user.id, docId: documentAnswer.document.id});
            });
        }
        showModal = false;
    }
</script>

<main class="h-screen w-screen flex flex-col bg-blue-50 dark:bg-slate-600 overflow-hidden">
    <SvelteToast options={toastOptions} />
    {#if showModal}
        <div class="fixed inset-0 z-20 backdrop-blur-[2px] backdrop-brightness-75" out:fade={{duration: 250}}></div>
        <dialog open class="top-1/3 rounded-lg z-50 bg-transparent shadow-lg" out:fly={{ y: -20, easing: cubicOut, opacity: 0, duration: 250 }}>
            <div class="flex p-2 bg-blue-200 dark:bg-slate-800 rounded-t-lg border-t border-blue-400 dark:border-blue-950 border-x space-x-2">
                <button class="p-4 rounded-lg border {tab===0 ? 'bg-blue-100 dark:bg-slate-700 text-blue-800 dark:text-blue-300 border-blue-400 dark:border-blue-950 animate-translate-bottom-with-bounce' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:dark:text-white border-transparent animate-translate-top'}" on:click={() => tab=0}>New document</button>
                <button class="p-4 rounded-lg border {tab===1 ? 'bg-blue-100 dark:bg-slate-700 text-blue-800 dark:text-blue-300 border-blue-400 dark:border-blue-950 animate-translate-bottom-with-bounce' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:dark:text-white border-transparent animate-translate-top'}" on:click={() => tab=1}>Join document</button>
            </div>
            <div class="flex flex-col h-64 p-2 bg-blue-100 dark:bg-slate-700 rounded-b-lg border border-blue-400 dark:border-blue-950 justify-between">
                <div class="flex flex-col space-y-2">
                    <input class="w-full p-1 bg-blue-50 dark:bg-slate-700 rounded-lg border border-blue-400 dark:border-blue-950 dark:text-white outline-none focus:ring-1 focus:ring-blue-400 focus:dark:ring-blue-700 z-50 transition-all duration-150 {userNamePlaceholder==='User Name' ? 'dark:placeholder-white' : 'placeholder-red-500'}" placeholder={userNamePlaceholder} bind:value={userNameForm}/>
                    {#if tab===0}
                        <input class="w-full p-1 bg-blue-50 dark:bg-slate-700 rounded-lg border border-blue-400 dark:border-blue-950 dark:text-white outline-none focus:ring-1 focus:ring-blue-400 focus:dark:ring-blue-700 z-50 transition-all duration-150 {documentNamePlaceholder==='Document title' ? 'dark:placeholder-white' : 'placeholder-red-500'}" placeholder={documentNamePlaceholder} bind:value={documentNameForm}/>
                    {:else}
                        <input class="w-full p-1 bg-blue-50 dark:bg-slate-700 rounded-lg border border-blue-400 dark:border-blue-950 dark:text-white outline-none focus:ring-1 focus:ring-blue-400 focus:dark:ring-blue-700 z-50 transition-all duration-150 {documentIdPlaceholder==='Document ID' ? 'dark:placeholder-white' : 'placeholder-red-500'}" placeholder={documentIdPlaceholder} bind:value={documentIdForm}/>
                    {/if}
                </div>
                <div class="flex w-full justify-center">
                    <button class="flex gap-1 py-1 px-2 bg-transparent text-gray-700 dark:text-white rounded-lg border border-green-400 dark:border-green-700 hover:bg-green-400 dark:hover:bg-green-700 font-medium active:scale-95 select-none" on:click={onConfirm}>
                        Confirm
                        <svg class="fill-gray-700 dark:fill-white h-6" viewBox="0 0 24 24" height="48px"><path d="M 19.28125 5.28125 L 9 15.5625 L 4.71875 11.28125 L 3.28125 12.71875 L 8.28125 17.71875 L 9 18.40625 L 9.71875 17.71875 L 20.71875 6.71875 Z"/></svg>
                    </button>
                </div>
            </div>
        </dialog>
    {/if}

    <div class="flex px-2 py-1 h-12 items-center justify-between bg-blue-200 dark:bg-slate-800 border-t border-b border-gray-300 dark:border-gray-600">
        <div class="flex mr-2">
            <input class="p-1 bg-blue-50 dark:bg-slate-700 rounded-l-lg border border-slate-400 dark:border-gray-600 dark:placeholder-white dark:text-white outline-none focus:ring-1 focus:ring-blue-400 focus:dark:ring-blue-700 z-10 transition-all duration-150" placeholder="File name" bind:value={docName} on:click={() => oldDocName = docName} id="doc-name-input"/>
            <p class="p-1 bg-blue-100 dark:bg-gray-800 rounded-r-lg border-y border-r border-slate-400 dark:border-gray-600 dark:text-white select-none">.md</p>
        </div>
        <div class="flex h-full items-center space-x-2">
            <div class="flex h-8 space-x-2">
                {#each connectedUser as user}
                    <IconBadge name={user.userName} />
                {/each}
            </div>
            <span class="toggle dark:text-white flex items-center justify-center"></span>
            <div class="flex lg:text-lg text-sm h-full whitespace-nowrap">
                <p class="flex items-center p-1 h-full bg-blue-100 dark:bg-gray-800 rounded-l-lg border-y border-l border-slate-400 dark:border-gray-600 dark:text-white select-none">
                    Doc ID:
                </p>
                <p class="flex items-center p-1 h-full bg-blue-50 dark:bg-slate-700 rounded-r-lg border border-slate-400 dark:border-gray-600 dark:placeholder-white dark:text-white">
                    {documentAnswer?.document.id ? documentAnswer.document.id : 'No document ID'}
                </p>
            </div>
            <div class="group relative flex justify-center whitespace-nowrap py-1 px-3 dark:text-white bg-blue-100 dark:bg-slate-700 rounded-lg border border-slate-400 dark:border-gray-600">
                <p class="font-semibold text-lg select-none">i</p>
                <div class="group-hover:block hidden absolute top-12 p-2 bg-blue-100 dark:bg-slate-600 rounded-lg border border-gray-300 dark:border-gray-500 z-50">
                    <p class="">Number of words: {nbOfWords}</p>
                    <p class="">Number of characters: {nbOfChars}</p>
                </div>
            </div>
            <div class="group relative flex justify-center whitespace-nowrap">
                <button class="hover:bg-blue-50 p-1 bg-blue-100 dark:bg-slate-700 dark:fill-slate-300 border rounded-lg active:scale-90 border-slate-400 dark:border-gray-600 transition-all duration-100" on:click={downloadCode}>
                    <svg class="h-7 select-none" viewBox="0 0 16 16"><path d="M7 2v7.293L4.352 6.648l-.704.704L7.5 11.207l3.855-3.855-.71-.704L8 9.293V2ZM3 13v1h9v-1Z"/></svg>
                </button>
                <div class="group-hover:block hidden absolute top-12 p-2 bg-blue-100 dark:bg-slate-600 rounded-lg border border-gray-300 dark:border-gray-500 z-50">
                    <p class="dark:text-white">Download document</p>
                </div>
            </div>
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
        </div>
    </div>
    <div class="flex h-full w-full dark:[color-scheme:dark] overflow-auto">
        <div class="flex h-full overflow-y-auto {selectedViewMode===ViewMode.CODE ? 'w-full': 'w-1/2'} {selectedViewMode===ViewMode.FORMATTED && 'hidden'}" id="code-container">
            <div class="w-full h-full" bind:this={editorContainer} />
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

    :root {
        --toastContainerTop: auto;
        --toastContainerRight: 2rem;
        --toastContainerBottom: 2rem;
        --toastContainerLeft: auto;
    }
    :global(.error) {
        --toastBackground: #f56565;
        --toastBarBackground: #e53e3e;
    }
</style>