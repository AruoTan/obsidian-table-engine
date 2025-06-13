export class FootMgr {
  private footMap: Record<string, string> = {};
  private count = 0;

  /**
   * 临时替换脚注为唯一标识符
   */
  dummy(text: string): string {
    return text.replace(/\[\^(.+?)\]/g, (res) => {
      const key = `__foot${this.count++}__`;
      this.footMap[key] = res;
      return key;
    });
  }

  /**
   * 保留原始脚注元素
   */
  retain(el: HTMLElement): void {
    const footEls = Array.from(el.querySelectorAll(".footnote-link"));
    if (!footEls.length) return;

    footEls.forEach((fEl) => {
      const id = fEl.getAttribute("data-footnote-id");
      if (!id) return;

      const key = `__foot${this.count++}__`;
      this.footMap[key] =
        `<span class="footnote-link" data-footnote-id="${id}"></span>`;
      fEl.replaceWith(document.createTextNode(key));
    });
  }

  /**
   * 处理内联脚注
   */
  handleInline(el: HTMLElement): void {
    const footEls = Array.from(el.querySelectorAll(".footnote-link"));
    if (!footEls.length) return;

    // 保留内联脚注
    footEls.forEach((fEl) => {
      const id = fEl.getAttribute("data-footnote-id");
      if (!id) return;

      const parent = fEl.parentElement;
      if (parent?.hasClass("footnote")) {
        parent.detach();
      }
    });
  }

  /**
   * 恢复脚注内容
   */
  restore(html: string): string {
    return Object.entries(this.footMap).reduce(
      (acc, [key, value]) => acc.replace(key, value),
      html
    );
  }
}
