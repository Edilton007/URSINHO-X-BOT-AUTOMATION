const fs = require("fs");
const path = require("path");

const MENUS_DIR = path.join(__dirname, "../assets/menus");

const MENU_FILES = {
  principal: { mp4: "principal.mp4", jpg: "principal.jpg" },
  owner: { mp4: "owner.mp4", jpg: "owner.jpg" },
  admin: { mp4: "admin.mp4", jpg: "admin.jpg" },
  vendas: { mp4: "vendas.mp4", jpg: "vendas.jpg" },
  downloads: { mp4: "downloads.mp4", jpg: "downloads.jpg" },
  grupo: { mp4: "grupo.mp4", jpg: "grupo.jpg" },
  ia: { mp4: "ia.mp4", jpg: "ia.jpg" },
  personalizar: { mp4: "personalizar.mp4", jpg: "personalizar.jpg" },
  seguranca: { mp4: "seguranca.mp4", jpg: "seguranca.jpg" },
  jogos: { mp4: "jogos.mp4", jpg: "jogos.jpg" },
};

function resolveMenuMedia(type = "principal") {
  const item = MENU_FILES[type] || MENU_FILES.principal;

  const videoPath = path.join(MENUS_DIR, item.mp4);
  const imagePath = path.join(MENUS_DIR, item.jpg);

  if (fs.existsSync(videoPath)) {
    return {
      kind: "video",
      path: videoPath,
      mime: "video/mp4",
    };
  }

  if (fs.existsSync(imagePath)) {
    return {
      kind: "image",
      path: imagePath,
      mime: "image/jpeg",
    };
  }

  return null;
}

module.exports = {
  MENU_FILES,
  resolveMenuMedia,
};
