document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.getElementById("tt-grid");
  const tabs = document.querySelectorAll(".day-tabs .chip");

  const START = 10 * 60;
  const END = 16 * 60;
  const SLOT = 5;
  const ROWS = (END - START) / SLOT;

  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  function render(day) {
    wrap.innerHTML = "";
    wrap.style.gridTemplateRows = `36px repeat(${ROWS}, 9px)`;

    const venues = [
      { key: "main", label: "メインステージ(第一体育館)", col: 2 },
      { key: "open", label: "野外ステージ(中庭)", col: 3 },
    ];

    venues.forEach((v) => {
      const h = document.createElement("div");
      h.className = "tt-venue";
      h.style.gridColumn = v.col;
      h.textContent = v.label;
      wrap.appendChild(h);
    });

    for (let m = START; m <= END; m += 60) {
      const row = (m - START) / SLOT + 2;
      const label = document.createElement("div");
      label.className = "tt-time";
      label.style.gridColumn = 1;
      label.style.gridRow = `${row} / span 1`;
      label.textContent = `${Math.floor(m / 60)}:00`;
      wrap.appendChild(label);

      if (m < END) {
        venues.forEach((v) => {
          const cell = document.createElement("div");
          cell.className = "tt-cell";
          cell.style.gridColumn = v.col;
          cell.style.gridRow = `${row} / span 12`;
          wrap.appendChild(cell);
        });
      }
    }

    STAGE_EVENTS.filter((e) => e.day === day).forEach((e) => {
      const rowStart = (toMin(e.start) - START) / SLOT + 2;
      const rowEnd = (toMin(e.end) - START) / SLOT + 2;
      const block = document.createElement("div");
      const dur = toMin(e.end) - toMin(e.start);
      block.className = "tt-event" + (dur < 30 ? " tt-sm" : "");
      block.style.gridColumn = e.venue === "main" ? 2 : 3;
      block.style.gridRow = `${rowStart} / ${rowEnd}`;
      block.innerHTML = `<p class="tm">${e.start} – ${e.end}</p><p class="tt">${e.title}</p><p class="to">${e.org}</p>`;
      block.querySelectorAll("p").forEach((p) => (p.style.margin = "0"));
      wrap.appendChild(block);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      render(Number(tab.dataset.day));
    });
  });

  render(1);
});
