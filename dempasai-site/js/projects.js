document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("project-grid");
  const countNote = document.getElementById("count-note");
  const searchInput = document.getElementById("search");
  const chips = document.querySelectorAll(".filters .chip");

  const state = { cat: "all", q: "" };

  function matches(p) {
    if (state.cat === "fav" && !isFaved(p.id)) return false;
    if (state.cat !== "all" && state.cat !== "fav" && p.cat !== state.cat) return false;
    if (state.q) {
      const hay = `${p.name} ${p.org} ${p.place} ${p.desc}`.toLowerCase();
      if (!hay.includes(state.q)) return false;
    }
    return true;
  }

  function render() {
    grid.innerHTML = "";
    const list = PROJECTS.filter(matches);
    countNote.textContent = `${list.length} 件の企画`;

    if (list.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent =
        state.cat === "fav"
          ? "お気に入りはまだありません。気になる企画のハートを押してみてください。"
          : "条件にあう企画が見つかりませんでした。";
      grid.appendChild(empty);
      return;
    }

    list.forEach((p) => {
      const card = document.createElement("article");
      card.className = "project-card";
      card.innerHTML = `
        <p class="cat">${CATEGORIES[p.cat]}</p>
        <h3>${p.name}</h3>
        <p class="org">${p.org}</p>
        <p class="desc">${p.desc}</p>
        <p class="place">${p.place} / ${p.time}</p>`;
      card.appendChild(
        createFavButton(p.id, () => {
          if (state.cat === "fav") render();
        })
      );
      grid.appendChild(card);
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.cat = chip.dataset.cat;
      render();
    });
  });

  searchInput.addEventListener("input", () => {
    state.q = searchInput.value.trim().toLowerCase();
    render();
  });

  render();
});
