<script lang="ts">
    export let name: string;
    //random color
    let color: string = "#" + Math.floor(Math.random()*16777215).toString(16);
    // determine if text should be white or black from background color
    let textColor = parseInt(color.substring(1,7),16) > 0xffffff/2 ? "text-black" : "text-white";
</script>

<div class="group relative flex justify-center items-center whitespace-nowrap rounded-full h-full w-8 z-50" style="background-color: {color}">
    <p class="select-none {textColor}">{name.slice(0,2)}</p>
    <div class="group-hover:block hidden absolute top-12 p-2 bg-blue-100 dark:bg-slate-600 rounded-lg border border-gray-300 dark:border-gray-500">
        <p class="dark:text-white">{name}</p>
    </div>
</div>