<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  export let initialWidth = 420;
  export let minWidth = 300;
  export let maxWidth = 900;
  export let localStorageKey = 'chatSidebarWidth';
  export let collapsedKey = 'chatSidebarCollapsed';

  let mountEl: HTMLDivElement;
  let root: any = null;

  let width = initialWidth;
  let isResizing = false;
  let collapsed = false;

  if (browser) {
    const saved = Number(localStorage.getItem(localStorageKey));
    if (!Number.isNaN(saved) && saved > 0) width = saved;
    const savedCollapsed = localStorage.getItem(collapsedKey);
    if (savedCollapsed === 'true') collapsed = true;
  }

  function persist() {
    if (!browser) return;
    localStorage.setItem(localStorageKey, String(width));
  }
  function persistCollapsed() {
    if (!browser) return;
    localStorage.setItem(collapsedKey, String(collapsed));
  }

  function startResize(e: PointerEvent) {
    isResizing = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    if (!isResizing) return;
    const viewportWidth = window.innerWidth;
    // سایدبار راست: فاصله از راست تا مرز درگ
    const newWidth = Math.min(maxWidth, Math.max(minWidth, viewportWidth - e.clientX));
    width = newWidth;
  }
  function endResize(e: PointerEvent) {
    if (!isResizing) return;
    isResizing = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    persist();
  }
  function toggleCollapsed() {
    collapsed = !collapsed;
    persistCollapsed();
  }
  function resetWidth() {
    width = initialWidth;
    persist();
  }

  let cleanup: (() => void) | null = null;
  onMount(async () => {
    const [{ default: React }, { createRoot }] = await Promise.all([
      import('react'),
      import('react-dom/client')
    ]);
    const { default: ChatAssistantWidget } = await import('$lib/react/ChatAssistantWidget');

    root = createRoot(mountEl);
    root.render(React.createElement(ChatAssistantWidget));
    cleanup = () => root?.unmount();
  });

  onDestroy(() => { cleanup?.(); });
</script>

<!-- نکتهٔ مهم: dir="ltr" تا ستونِ راست، راست بماند حتی در RTL کل صفحه -->
<div class="fixed inset-0 z-[200] pointer-events-none" dir="ltr">
  <div
    class="grid h-full w-full pointer-events-none"
    style={`grid-template-columns: 1fr ${collapsed ? '0px' : width + 'px'};`}
  >
    <!-- ستون ۱: محتوای صفحه -->
    <div class="h-full w-full pointer-events-auto">
      <slot />
    </div>

    <!-- ستون ۲: سایدبار سمت راست -->
    <aside
      class="relative h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl pointer-events-auto overflow-hidden transition-[width] duration-150"
      aria-label="AI Assistant Sidebar"
    >
      <!-- هدر -->
      <div class="h-11 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/60 backdrop-blur">
        <div class="text-xs font-medium text-gray-600 dark:text-gray-300">Chat Assistant</div>
        <div class="flex items-center gap-1">
          <button class="px-2 py-1 text-xs rounded hover:bg-gray-200/60 dark:hover:bg-gray-700" on:click={resetWidth} title="Reset width">Reset</button>
          <button class="px-2 py-1 text-xs rounded hover:bg-gray-200/60 dark:hover:bg-gray-700" on:click={toggleCollapsed} title={collapsed ? 'Open sidebar' : 'Close sidebar'}>{collapsed ? 'Open' : 'Close'}</button>
        </div>
      </div>

      <!-- بدنهٔ سایدبار: ویجت React -->
      <div class="h-[calc(100%-2.75rem)] overflow-hidden">
        <div bind:this={mountEl} class="h-full w-full"></div>
      </div>

      <!-- گِرِپ درگ: لبهٔ چپ سایدبار -->
      <div
        class="absolute top-0 left-0 h-full w-1.5 cursor-col-resize hover:bg-sage/40 active:bg-sage/60"
        on:pointerdown={startResize}
        on:pointermove={onMove}
        on:pointerup={endResize}
        on:dblclick={resetWidth}
        title="Drag to resize • Double click to reset"
        aria-label="Resize sidebar"
      ></div>
    </aside>
  </div>
</div>

<style>
  :global(body) { user-select: none; }
</style>
