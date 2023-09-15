<script lang="ts">
	import settingsIcon from "$lib/assets/settings.svg";
	import downloadIcon from "$lib/assets/download.svg"

	let fileName = '';
    let code: string = '';
	$: nbOfLines = code.split(/\r\n|\r|\n/).length;
</script>

<main class="h-screen w-screen flex flex-col flex-grow">
    <div class="flex m-2 h-8 items-center justify-between bg-amber-300">
        <input class="bg-red-200" bind:value={fileName} />
        <div class="flex bg-amber-700 h-full items-center space-x-2">
            <button>
                <img src={downloadIcon} class="h-8 select-none" alt="settings icon"/>
            </button>
            <button>
                <img src={settingsIcon} class="h-14 select-none" alt="settings icon"/>
            </button>
        </div>
    </div>
    <div class="flex h-full w-full bg-blue-400">
        <div class="h-full w-8 bg-red-500">
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
            <div class="flex flex-grow bg-blue-200 h-full">

            </div>
        </div>
    </div>
</main>