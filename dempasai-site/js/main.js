const FAV_KEY = "dempasai-favs";

function getFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

function isFaved(id) {
  return getFavs().includes(id);
}

function toggleFav(id) {
  const favs = getFavs();
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1);
  else favs.push(id);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  return i < 0;
}

const HEART_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20 c-5-4-8-6.5-8-10 a4.2 4.2 0 0 1 8-1.8 a4.2 4.2 0 0 1 8 1.8 c0 3.5-3 6-8 10z"/></svg>';

function createFavButton(id, onChange) {
  const btn = document.createElement("button");
  btn.className = "fav-btn" + (isFaved(id) ? " faved" : "");
  btn.innerHTML = HEART_SVG;
  btn.setAttribute("aria-label", "お気に入りに追加");
  btn.setAttribute("aria-pressed", String(isFaved(id)));
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const added = toggleFav(id);
    btn.classList.toggle("faved", added);
    btn.setAttribute("aria-pressed", String(added));
    if (added) {
      const pop = document.createElement("span");
      pop.className = "meki";
      pop.textContent = "滅";
      btn.appendChild(pop);
      setTimeout(() => pop.remove(), 700);
    }
    if (onChange) onChange(added);
  });
  return btn;
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.dataset.page === page) a.classList.add("current");
  });

  const menuBtn = document.querySelector(".menu-btn");
  const nav = document.querySelector(".nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => nav.classList.toggle("open"));
  }

  const cd = document.getElementById("countdown");
  if (cd) {
    const open = new Date("2026-10-31T09:30:00+09:00");
    const days = Math.ceil((open - Date.now()) / 86400000);
    if (days > 1) cd.textContent = `開催まであと ${days} 日`;
    else if (days >= 0) cd.textContent = "本日開催";
    else cd.textContent = "今年度の電波祭は終了しました";
  }

  const newsList = document.getElementById("news-list");
  if (newsList && typeof NEWS !== "undefined") {
    const limit = Number(newsList.dataset.limit || NEWS.length);
    NEWS.slice(0, limit).forEach((n) => {
      const a = document.createElement("a");
      a.className = "news-row";
      a.href = n.href;
      a.innerHTML = `<span class="date">${n.date}</span><span>${n.text}</span>`;
      newsList.appendChild(a);
    });
  }
});
