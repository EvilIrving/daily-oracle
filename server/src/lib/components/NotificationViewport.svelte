<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { notifications } from '$lib/notifications';

  const dismiss = (id: string) => notifications.dismiss(id);
</script>

<div class="notification-viewport" aria-live="polite" aria-atomic="true">
  {#each $notifications as item (item.id)}
    <article
      class={`notification-card notification-${item.type}`}
      role="status"
      in:fly={{ y: 18, duration: 180 }}
      out:fade={{ duration: 140 }}
    >
      <div class="notification-copy">
        <strong>{item.type === 'error' ? '操作失败' : '操作成功'}</strong>
        <p>{item.message}</p>
      </div>
      <button type="button" class="notification-close" on:click={() => dismiss(item.id)} aria-label="关闭通知">
        ×
      </button>
    </article>
  {/each}
</div>
