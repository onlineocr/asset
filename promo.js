<script>
(function () {
  const promoPages = [
    "https://onlineocr.io/pdf-to-text",
    "https://onlineocr.io/png-to-text",
    "https://onlineocr.io/jpg-to-text",
    "https://onlineocr.io/tiff-to-text"
  ];
  const currentPage = window.location.href.split("?")[0].replace(/\/$/, "");
  if (!promoPages.includes(currentPage)) return;

  const today = new Date().toISOString().split("T")[0];
  const dailyKey = `promoModal_${currentPage}_${today}`;
  const permanentKey = `promoModalShared_${currentPage}`;
  if (localStorage.getItem(dailyKey) || localStorage.getItem(permanentKey)) return;

  const modalHTML = `
<div class="modal fade" id="infoModal" tabindex="-1" aria-labelledby="infoModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content shadow">
      <div class="modal-header p-2 bg-success text-white">
        <h5 class="modal-title m-0" id="infoModalLabel">Just a Humble Request</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body text-center">
        <p class="mb-3 fw-semibold text-dark">
          <span class="d-block mb-2">We're covering all costs — no ads, no sign-up, no fees. Just fast, accurate OCR.</span>
          👉 If this helped you, please <strong class="text-primary">share it now</strong> and help us keep it 100% free for everyone!
        </p>
        <div class="d-flex justify-content-center gap-3 mt-3 mb-4">
          <a href="https://www.facebook.com/sharer/sharer.php?u=https://onlineocr.io" target="_blank" class="share-btn text-decoration-none fs-4 text-primary"><i class="bi bi-facebook"></i></a>
          <a href="https://twitter.com/intent/tweet?url=https://onlineocr.io&text=Check%20out%20this%20free%20OCR%20tool!" target="_blank" class="share-btn text-decoration-none fs-4 text-info"><i class="bi bi-twitter-x"></i></a>
          <a href="https://api.whatsapp.com/send?text=Check%20out%20this%20free%20OCR%20tool!%20https://onlineocr.io" target="_blank" class="share-btn text-decoration-none fs-4 text-success"><i class="bi bi-whatsapp"></i></a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://onlineocr.io" target="_blank" class="share-btn text-decoration-none fs-4 text-primary"><i class="bi bi-linkedin"></i></a>
        </div>
        <div class="form-check text-start px-4">
          <input class="form-check-input" type="checkbox" id="dontShowAgain">
          <label class="form-check-label small" for="dontShowAgain">I will share sometime, skip now</label>
        </div>
      </div>
    </div>
  </div>
</div>
`;

  document.addEventListener("DOMContentLoaded", function () {
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const showModalIfNeeded = () => {
      if (localStorage.getItem(dailyKey) || localStorage.getItem(permanentKey)) return false;

      const btn = document.getElementById("downloadZipBtn");
      if (btn && btn.innerText.trim().toLowerCase() === "download all") {
        const modal = document.getElementById("infoModal");
        if (modal) {
          const bsModal = new bootstrap.Modal(modal);
          bsModal.show();

          document.getElementById("dontShowAgain")?.addEventListener("change", function () {
            if (this.checked) localStorage.setItem(dailyKey, "1");
          });

          document.querySelectorAll(".share-btn").forEach(el => {
            el.addEventListener("click", () => {
              localStorage.setItem(permanentKey, "1");
              bsModal.hide();
            });
          });

          return true;
        }
      }
      return false;
    };

    if (showModalIfNeeded()) return;

    const observer = new MutationObserver(() => {
      if (showModalIfNeeded()) {
        observer.disconnect();
        clearInterval(interval);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const interval = setInterval(() => {
      if (showModalIfNeeded()) {
        clearInterval(interval);
        observer.disconnect();
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      observer.disconnect();
    }, 30000);
  });
})();
</script>
