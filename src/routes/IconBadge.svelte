<script lang="ts">
    export let name: string;

    // Generate a random color for the avatar, and determine whether the text should be black or white
    let color: string = "#" + Math.floor(Math.random()*16777215).toString(16);
    let r = parseInt(color.slice(1,3), 16);
    let g = parseInt(color.slice(3,5), 16);
    let b = parseInt(color.slice(5,7), 16);
    let textColor: string = (r*0.299 + g*0.587 + b*0.114) > 186 ? "text-black" : "text-white";
</script>

<div class="group relative flex justify-center items-center whitespace-nowrap rounded-full h-full w-8 z-50" style="background-color: {color}">
    <p class="select-none {textColor}">{name.slice(0,2)}</p>
    <div class="group-hover:block hidden absolute top-12 p-2 bg-blue-100 dark:bg-slate-600 rounded-lg border border-gray-300 dark:border-gray-500">
        <p class="dark:text-white">{name}</p>
    </div>
</div>