<script lang="ts">
  import type { EventHandler } from 'svelte/elements';

  let {
    fileInput = null,
    isUploadDragging = false,
    onFileChange = (() => {}) as EventHandler<Event, HTMLInputElement>,
    onOpenFileInput = (() => {}) as EventHandler<MouseEvent, HTMLButtonElement>,
    onDragEnter = (() => {}) as EventHandler<DragEvent, HTMLDivElement>,
    onDragOver = (() => {}) as EventHandler<DragEvent, HTMLDivElement>,
    onDragLeave = (() => {}) as EventHandler<DragEvent, HTMLDivElement>,
    onDrop = (() => {}) as EventHandler<DragEvent, HTMLDivElement>
  } = $props();
</script>

<div
  class={`flex w-[10%] min-w-[120px] flex-col items-center justify-center rounded-[18px] border border-dashed transition ${
    isUploadDragging ? 'border-[#b59067] bg-[#fff7eb]' : 'border-[#d4c7b8] bg-[#fffdf8]'
  }`}
  role="group"
  aria-label="TXT 文件上传区"
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <input
    bind:this={fileInput}
    class="hidden"
    type="file"
    multiple
    accept=".txt,text/plain"
    onchange={onFileChange}
  />
  <button
    class="w-full px-2 py-4 text-center"
    type="button"
    onclick={onOpenFileInput}
  >
    <p class="text-xs text-[#7a6a58]">拖入或点击</p>
    <span class="btn-secondary mt-2 inline-flex cursor-pointer px-3 py-1.5 text-xs font-medium">
      选择 txt
    </span>
  </button>
</div>
