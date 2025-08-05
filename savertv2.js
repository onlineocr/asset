// Global Variables
let useForAndroid = 0;
let filesToIgnore = [];
let extractedText = '';
let selectedLang = '';
let pageNum = 0;
let totPage = 0;
let _MatchFound = 0;
const allowFileSize = 50;
const allowMaxFiles = 10;
const fileType = 'image/tiff';
const fileExt = 'TIFF files';
const zipFileName = "OnlineOcr.io-Tif2Txt.zip";
const pleaseUploadMsg = 'Please upload TIFF files.';
const singleFileOcrMsg = `<strong>Language Selection:</strong><br>
                              Please choose the language of the text your TIFF image contains.  
                              For example, select <strong>English</strong> if the text is in English, <strong>Russian</strong> for Russian, <strong>Arabic</strong> for Arabic, and so on.  
                              <br><br>
                              This helps the text extraction engine extract content more accurately based on your selection.<br><br>
                              If your images contain different languages, you can select a language for each image individually.  
                              If all images contain text in the same language, you can select it once for all.`;
const OcrCompleteMsg = `You can view the extracted text for each image and download its corresponding text file by clicking 
                            <strong class="badge text-bg-secondary">View Text</strong>.  
                            To save all text files at once, simply click <strong class="badge text-bg-success">Download All</strong>`;
const genMsgAfterOcr = 'You can view the extracted text for each image and download its corresponding text file by clicking <strong class="badge text-bg-secondary">View Text</strong>. To save all text files at once, simply click the button below';

const rtlLanguages = ['ara', 'heb', 'fas', 'urd'];
const randomNumber = generateRandomNumber();

const DB_NAME = 'TifDatabase';
const STORE_NAME = 'pages';
let db;
const fileInput = document.getElementById('tifUpload');


// DOM Ready Handler with async cleanup
$(document).ready(async function () {
    try {
        $("#toggleInfo").on("click", function () {
            $("#dynamicMsgPanel").toggleClass("d-none");
    
            // Toggle between icon and close button
            const icon = $("#hideShowMsg");
            if ($("#dynamicMsgPanel").hasClass("d-none")) {
                icon.removeClass("btn-close").addClass("bi bi-info-circle");
            } else {
                icon.removeClass("bi bi-info-circle").addClass("btn-close");
            }
        });
        initializeLanguageSelectors();
        setupEventListeners();
        setInterval(checkOrigin, 1000);

        // Async cleanup with error handling
        const deleted = await deleteExpiredRecords();
        if (deleted > 0) {
            console.log(`Deleted ${deleted} expired records`);
        }
    } catch (error) {
        console.error('Failed to clean expired records:', error);
    }
});

// Initialize Select2 language selectors
function initializeLanguageSelectors() {
    function formatOption(option) {
        if (!option.id) return option.text;
        return $(
            '<span class="flag-option">' +
            '<span class="flag-icon flag-icon-' + $(option.element).data('flag') + '"></span>' +
            option.text +
            '</span>'
        );
    }

    $('#ocrLang').select2({
        templateResult: formatOption,
        templateSelection: formatOption,
        width: 'resolve'
    });
}

// Set up event listeners
function setupEventListeners() {
    // Toggle single language selector
    document.getElementById('AretifsSame').addEventListener('change', function () {
        const elementToHide = document.getElementById('langSelectorPanel');
        elementToHide.style.display = this.checked ? 'block' : 'none';
        $('._selectLang').toggle(!this.checked);
    });

    // Set up copy button
    $(`body`).on('click', `#copyPreviewText`, async function () {
        const textarea = document.getElementById(`OcrPreview`);
        await navigator.clipboard.writeText(textarea.value);
        $(`#copyPreviewText`).text('✓ Copied');
        setTimeout(() => {
            $(`#copyPreviewText`).html('<i class="bi bi-clipboard"></i> Copy');
        }, 2000);
    });

    // File upload handler
    fileInput.addEventListener('change', () => handleFileUpload(fileInput));

    // OCR button handler
    $('#_OcrClick').on('click', processAlltifs);

    // Download ZIP handler
    document.getElementById("downloadZipBtn").addEventListener("click", downloadAllTextFiles);
}

// Handle file upload
async function handleFileUpload(inputElement) {
    const isValid = await validateUploadedFiles(inputElement);
    $('#_uploadPanel').addClass('d-none');

    if (!isValid) {
        $('#_sideBar').remove();
        window.location.reload();
        return;
    }

    const files = inputElement.files;
    if (files.length === 0) {
        alert(pleaseUploadMsg);
        return;
    }

    // Clear existing thumbnails and show loading indicator
    $('.tool__header').remove();
    $('.toRemove').remove();
    $('.toHide').addClass('d-none');
    $('.toShow').removeClass('d-none');
    $('#_tif-thumbnails').html(`
        <div id="loading_initial" class="col col-auto colas d-flex justify-content-center _tifCard"><div><figure class="figure p-3 alert alert-warning border-dashed _tifCard rounded pb-4 pt-4 justify-content-center" style="max-width: 160px;height: -webkit-fill-available;">Please wait while we load your <strong class="fw-bold">TIFF</strong> files... <div role="status" class="spinner-border text-dark spinner-border-sm"></div></figure></div></div>
      `);

    // Process each file
    for (let i = 0; i < files.length; i++) {
        if (filesToIgnore.includes(i)) continue;

        const file = files[i];
        if (file.type === fileType) {
            await processtifFile(file, i);
        }
    }

    // Show sidebar when processing is complete
    showSidebarWhenReady(files.length);

    // Set up thumbnail event handlers
    setupThumbnailEventHandlers();
}

// Process a single tif file
async function processtifFile(file, index) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async function (e) {
            const arrayBuffer = e.target.result;
            const imgData = await generatetifThumbnail(arrayBuffer, 1);
            createtifThumbnailCard(index, file.name, file.size, imgData[0].image, '_tif-thumbnails');
            resolve();
        };
        reader.readAsArrayBuffer(file);
    });
}

// Generate tif thumbnail
async function generatetifThumbnail(tiffData, pageNumber = null) {
    const tiff = new Tiff({ buffer: tiffData });
    const numPages = tiff.countDirectory();

    const renderPage = async (pageNum) => {
        tiff.setDirectory(pageNum - 1);
        const canvas = tiff.toCanvas();

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const blobUrl = URL.createObjectURL(blob);

                // Cleanup canvas
                canvas.width = 0;
                canvas.height = 0;
                if (canvas.parentNode) {
                    canvas.remove();
                }

                resolve({
                    image: blobUrl,
                    pageNumber: pageNum
                });
            }, "image/png");
        });
    };

    const images = [];

    if (pageNumber) {
        images.push(await renderPage(pageNumber));
    } else {
        for (let i = 1; i <= numPages; i++) {
            images.push(await renderPage(i));
        }
    }

    // Clean up TIFF object
    if (typeof tiff.close === 'function') {
        tiff.close(); // optional: depends on tiff.js version
    }

    return images;
}



// Create tif thumbnail card
function createtifThumbnailCard(fileId, fileName, fileSize, imageUrl, parentElementId) {
    const parentElement = document.getElementById(parentElementId);
    if (!parentElement) return;

    // Create main container
    const colDiv = document.createElement('div');
    colDiv.className = `col col-auto colas d-flex justify-content-center _tifCard del-f-${fileId}`;
    colDiv.dataset.fi = fileId;

    // Create options header
    const optionsSpan = document.createElement('span');
    optionsSpan.className = '_tifCardHeader';

    // Add delete button
    const deleteSpan = document.createElement('span');
    deleteSpan.className = 'text-danger cursor-pointer del-f fw-bold';
    deleteSpan.title = 'Remove this image from list';
    deleteSpan.dataset.fd = fileId;
    deleteSpan.innerText = 'X';
    deleteSpan.style.position = 'relative';
    deleteSpan.style.right = '-145px';

    deleteSpan.addEventListener('click', function () {
        const indexToRemove = parseInt(this.getAttribute('data-fd'));
        if ($('.colas').length === 1) {
            window.location.reload();
            return;
        }

        $(`.del-f-${indexToRemove}`).remove();
        filesToIgnore.push(indexToRemove);
    });

    optionsSpan.appendChild(deleteSpan);

    // Add view text button
    const viewPagesSpan = document.createElement('span');
    viewPagesSpan.className = 'badge bg-secondary mt-1 _viewPages d-none';
    viewPagesSpan.id = `_OcrLanguage${fileId}`;
    viewPagesSpan.dataset.fi = fileId;
    viewPagesSpan.dataset.fn = fileName;
    viewPagesSpan.dataset.fl = '-';
    viewPagesSpan.title = 'View text of this image';
    viewPagesSpan.innerText = 'View Text';
    optionsSpan.appendChild(viewPagesSpan);

    // Add language selector button
    const langSelectSpan = document.createElement('span');
    langSelectSpan.className = 'badge bg-secondary mt-1 _selectLang';
    langSelectSpan.id = `_selectedLang${fileId}`;
    langSelectSpan.dataset.fl = '-';
    langSelectSpan.dataset.fi = fileId;
    langSelectSpan.dataset.fn = fileName;
    langSelectSpan.title = 'Select the language of the text used in this image.';
    langSelectSpan.innerText = 'Select Language';
    optionsSpan.appendChild(langSelectSpan);

    // Create figure element for the thumbnail
    const figure = document.createElement('figure');
    figure.className = 'figure p-3 alert alert-secondary border-dashed _tifCard rounded pb-4 pt-4 justify-content-center';
    figure.dataset.fi = fileId;
    figure.dataset.fn = fileName;
    figure.dataset.fs = fileSize;
    figure.dataset.tp = 1;
    figure.ariaLabel = `${fileSize} - Pages 1`;
    figure.draggable = true;
    figure.id = fileId;

    // Create image element
    const imgElement = document.createElement('img');
    imgElement.src = imageUrl;
    imgElement.width = 120;
    imgElement.height = 140;
    imgElement.style.cursor = 'zoom-in';
    imgElement.alt = 'Page #1';
    imgElement.title = 'View first page of this Tiff image';
    imgElement.classList.add('_ViewtifImage');

    imgElement.addEventListener('click', function () {
        const modalImage = document.getElementById('modalImage');
        const modalImageLabel = document.getElementById('imageModalLabel');
        modalImage.src = this.src;
        modalImageLabel.innerText = fileName;
        new bootstrap.Modal(document.getElementById('imageModal')).show();
    });

    // Create caption
    const figCaption = document.createElement('figcaption');
    figCaption.className = 'figure-caption1 text-truncate thumbnailHeader';
    figCaption.title = fileName;
    figCaption.innerText = fileName;

    // Assemble the figure contents
    const wrapperDiv = document.createElement('div');
    figure.appendChild(optionsSpan);
    figure.appendChild(imgElement);
    figure.appendChild(figCaption);
    wrapperDiv.appendChild(figure);
    colDiv.appendChild(wrapperDiv);
    parentElement.appendChild(colDiv);
}

// Set up thumbnail event handlers
function setupThumbnailEventHandlers() {
    $('body').on('click', '._viewPages', function () {
        checkOrigin();
        showTextModal($(this));
    });

    $('body').on('click', '._selectLang', function () {
        checkOrigin();
        showLanguageModal($(this));

        const $btn = $(this);
        const selectedText = $btn.text().trim().toLowerCase();

        if (selectedText === 'select language') {
            $btn.text('Selected: US')
                .removeClass('bg-secondary')
                .addClass('bg-success');
        }
    });

    $('body').on('click', '._download', function () {
        checkOrigin();
        downloadTextFile($(this));
    });
}

// Show sidebar when all files are processed
function showSidebarWhenReady(filesCount) {
    const interval = setInterval(function () {
        const count = $('.colas').length;
        if ($('#_tif-thumbnails').length && count === filesCount + 1) {
            $('#loading_initial').remove();
            $('.tool__header').remove();
            $('._sideBarHide').removeClass('d-none');
            $('#_sideBar').removeClass('d-none');
            clearInterval(interval);
        }
    }, 1000);
}

// Process all tifs with OCR
async function processAlltifs() {
    let clear = 0;
    _MatchFound = 0;
    let _isSingleorAll = 0;
    const files = fileInput.files;

    // Validate language selection
    if ($('#AretifsSame').prop('checked')) {
        const _singleTerm = $('#ocrLang').val().trim();
        if (_singleTerm === "") {
            showHtmlAlert(singleFileOcrMsg);
            return;
        } else {
            _isSingleorAll = 1;
            clear = 1;
        }
    } else {
        for (let i = 0; i < files.length; i++) {
            if (!filesToIgnore.includes(i)) {
                if ($('#ocrLang' + i).length === 0 || $('#ocrLang' + i).val().trim() === "") {
                    showHtmlAlert(singleFileOcrMsg);
                    clear = 0;
                    break;
                } else {
                    clear = 1;
                }
            }
        }
    }

    if (clear !== 1) return;

    checkOrigin();
    $('#_processModalOcr').modal("show");

    // Process each file
    for (let i = 0; i < files.length; i++) {
        if (!filesToIgnore.includes(i)) {
            const file = files[i];
            const _selectedLang = _isSingleorAll === 1
                ? $('#ocrLang').val().trim()
                : $('#ocrLang' + i).val().trim();

            $(`#_OcrLanguage${i}`).attr('data-fl', _selectedLang);
            await performOCR(file, i, _selectedLang);
        }
    }
    fileInput.value = "";

    // Update UI after processing
    $('#_plzWaitOcr').addClass('')
        .removeClass('text-truncate')
        .html(OcrCompleteMsg);
    $('#OcrPreviewPanel').remove();
    $('#_processModalOcrBody').removeClass('text-center p-4');
    $('#realStatusOcr').text('');
    $('#_processModalOcrCancel').removeClass('d-none');
    $('#_donotOcr').text('');
    $('#_OcrStuff').remove();
    $('#downloadZipBtn').removeClass('d-none');
    $('#_spin').remove();
    $('#_description').html(genMsgAfterOcr);
    $('.watermarkSetting').removeClass('d-none');
    $('#_SplitStuff').removeClass('d-none');
    $('._selectLang').addClass('d-none');
    $('._viewPages').removeClass('d-none');
}

// Perform OCR on a single TIFF (similar to tif version)
async function performOCR(file, fileID, _selectedLang) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = async function () {
            try {
                const typedArray = new Uint8Array(fileReader.result);
                await extractTextFromtif(typedArray, fileID, file, _selectedLang);
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        fileReader.onerror = () => reject('Error reading file');
        fileReader.readAsArrayBuffer(file);
    });
}

// Extract text from tif using OCR
async function extractTextFromtif(typedArray, fileID, file, _selectedLang) {
    const tiff = new Tiff({ buffer: typedArray });
    $('#_plzWaitOcr').html('<b class="fw-bold">Processing TIFF: </b>' + file.name + ' ');
    totPage = tiff.countDirectory();
    extractedText = '';

    // Process pages in batches
    const batchSize = 5;
    for (let i = 1; i <= totPage; i += batchSize) {
        const end = Math.min(i + batchSize - 1, totPage);
        const batchText = await processPageBatch(tiff, i, end, _selectedLang, fileID, file);
        extractedText += batchText;
    }

    pageNum = 0;
}

// Process a batch of TIFF pages (similar to tif version)
async function processPageBatch(tiff, start, end, _selectedLang, fileID, file) {
    const promises = [];

    for (let i = start; i <= end; i++) {
        const promise = (async (pageIndex) => {
            tiff.setDirectory(pageIndex - 1);
            const canvas = tiff.toCanvas();

            const text = await performPageOCR(canvas, _selectedLang, file);
            await storePageText(fileID, pageIndex, text);

            // ✅ Cleanup canvas
            canvas.width = 0;
            canvas.height = 0;
            if (canvas.parentNode) {
                canvas.remove();
            }

            return text;
        })(i);

        promises.push(promise);
    }

    const results = await Promise.all(promises);
    return results.join('');
}



// Perform OCR on a single page
// Perform OCR on a single page (similar to tif version but for TIFF canvas)
async function performPageOCR(canvas, _selectedLang, file) {
    const lang = _selectedLang;
    selectedLang = lang;

    const result = await Tesseract.recognize(canvas, lang, {
        logger: (m) => {
            if (m.status === 'recognizing text') {
                const progress = Math.floor(m.progress * 100);
                if (progress === 100) {
                    pageNum++;
                    $('#ocrResult').removeClass('d-none');
                }
                $('#realStatusOcr').text(`Extracting text: Page ${pageNum} of ${totPage} (${progress}%)`);
            }
        },
        preserve_interword_spaces: true,
        tessedit_pageseg_mode: 6,
        tessedit_create_hocr: 1,
        tessedit_create_txt: 1,
        tessedit_create_box: 1
    });

    // Clean up canvas to free memory
    canvas.width = 0;
    canvas.height = 0;
    if (canvas.parentNode) {
        canvas.remove();
    }

    // Optional: null references to help GC
    canvas = null;

    // Append result to preview
    $('#OcrPreview').val(function (index, currentText) {
        return `${currentText}${file.name}\nPage #${pageNum}\n===================\n${result.data.text}\n\n`;
    });

    $('#OcrPreview').scrollTop($('#OcrPreview')[0].scrollHeight);

    return result.data.text;
}



// Show text modal with extracted content
async function showTextModal(element) {
    const fileIndex = element.data('fi');
    const fileName = element.data('fn');
    const fileLang = element.data('fl');
    const _idView = "#_viewPages_" + fileIndex;

    if ($(_idView).length) {
        $(_idView).modal("show");
        return;
    }

    // Create modal HTML
    $("body").append(`
        <div class="modal fade" id="_viewPages_${fileIndex}" tabindex="-1" role="dialog" aria-hidden="false">
          <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header p-1">
                <h5 class="modal-title text-truncate m-1">${fileName}</h5>
                <button type="button" class="btn-close mr-1" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body" id="_PageDetailBody${fileIndex}">
                <textarea class="form-control ocrResult" rows="15" readonly id="_PageDetailBody1${fileIndex}"></textarea>
                <div class="btn-group-horizontal" role="group" aria-label="radio toggle button group" style="font-size: small;">
                  <label class="form-label text-success mb-0 ml-10">Lines: <span id="ocrTextLines${fileIndex}">0</span></label>
                  <label class="form-label text-dark mb-0 ml-10">Words: <span id="ocrTextWords${fileIndex}">0</span></label>
                  <label class="form-label text-success mb-0 ml-10">Spaces: <span id="ocrTextSpaces${fileIndex}">0</span></label>
                  <label class="form-label text-dark mb-0 ml-10">Characters: <span id="ocrTextCharacters${fileIndex}">0</span></label>
                  <label class="form-label text-success mb-0 ml-10">Language: <span id="ocrTextLanguage${fileIndex}">-</span></label>
                </div>
              </div>
              <div class="row text-center" id="_loading${fileIndex}">
                <div class="d-inline">
                  <p class="d-inline d-none">Please wait... </p>
                  <div class="spinner-border text-primary spinner-border-sm d-none" role="status"></div>
                </div>
                <p class="text-danger d-none fetchPages${fileIndex}">Fetching pages of selected tif</p>
              </div>
              <div class="modal-footer m-0 p-0">
                <button class="btn btn-link btn-sm text-decoration-none fw-bold _download" 
                  title="Download text file of ${fileName}" 
                  data-fi="${fileIndex}" 
                  data-fn="${fileName.replace(/\.[^/.]+$/, '.txt')}" 
                  type="button">Download Text File</button>
                  <span fi="${fileIndex}" class="sendtowa" title="Send extracted text to WhatsApp" style="cursor:pointer;"><i class="bi bi-whatsapp" style="color: green; font-size: 24px;"></i></span>
                <button id="copyText${fileIndex}" class="btn btn-warning btn-sm text-decoration-none" title="Copy above text">Copy</button>
                <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `);
    $(_idView).modal("show");

    // Set text direction based on language
    if (rtlLanguages.includes(fileLang)) {
        $(`#_PageDetailBody1${fileIndex}`).attr('dir', 'rtl');
    } else {
        $(`#_PageDetailBody1${fileIndex}`).attr('dir', 'ltr');
    }

    // Retrieve and display text
    let _pageText = await retrieveStoredText(fileIndex);
    _pageText = _pageText.replace(/<br\s*\/?>/g, '\n');

    // Calculate text statistics
    const totalLines = _pageText.split('\n').length;
    const totalWords = _pageText.trim().split(/\s+/).length;
    const totalSpaces = (_pageText.match(/\s/g) || []).length;
    const totalLength = _pageText.length;

    // Update statistics display
    $(`#ocrTextLines${fileIndex}`).text(totalLines);
    $(`#ocrTextWords${fileIndex}`).text(totalWords);
    $(`#ocrTextSpaces${fileIndex}`).text(totalSpaces);
    $(`#ocrTextCharacters${fileIndex}`).text(totalLength);
    $(`#ocrTextLanguage${fileIndex}`).text(fileLang);

    // Set text content
    $(`#_PageDetailBody1${fileIndex}`).val(_pageText);


    // Remove loading indicator
    $(`#_loading${fileIndex}`).remove();

    // Set up copy button
    $(`body`).on('click', `#copyText${fileIndex}`, async function () {
        const textarea = document.getElementById(`_PageDetailBody1${fileIndex}`);
        await navigator.clipboard.writeText(textarea.value);
        $(`#copyText${fileIndex}`).text('✓ Copied');
        setTimeout(() => {
            $(`#copyText${fileIndex}`).text('Copy');
        }, 2000);
    });
}

// Show language selection modal
async function showLanguageModal(element) {
    const fileIndex = element.data('fi');
    const fileName = element.data('fn');
    const _idViewL = `#_selectLang_${fileIndex}`;

    if ($(_idViewL).length) {
        $(_idViewL).modal("show");
        return;
    }

    // Create modal HTML
    $("body").append(`
        <div class="modal fade" id="_selectLang_${fileIndex}"  tabindex="-1"  role="dialog">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header p-1">
                <h5 class="modal-title text-truncate m-1">${fileName}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <label for="ocrLang${fileIndex}" class="form-label">Select the language used in this Tiff image:</label><br/>
                <select id="ocrLang${fileIndex}" class="form-select" style="width: 100%">
                  <!-- Language options would be inserted here -->
                          <option value="afr" data-flag="za"> Afrikaans (South Africa)</option>
        <option value="amh" data-flag="et"> Amharic (Ethiopia)</option>
        <option value="ara" data-flag="sa"> Arabic (Saudi Arabia)</option>
        <option value="asm" data-flag="in"> Assamese (India)</option>
        <option value="aze" data-flag="az"> Azerbaijani (Latin) (Azerbaijan)</option>
        <option value="aze_cyrl" data-flag="az">Azerbaijani (Cyrillic) (Azerbaijan)</option>
        <option value="bel" data-flag="by">Belarusian (Belarus)</option>
        <option value="ben" data-flag="bd">Bengali (Bangladesh)</option>
        <option value="bod" data-flag="cn">Tibetan (China)</option>
        <option value="bos" data-flag="ba">Bosnian (Bosnia)</option>
        <option value="bre" data-flag="fr">Breton (France)</option>
        <option value="bul" data-flag="bg">Bulgarian (Bulgaria)</option>
        <option value="cat" data-flag="es">Catalan (Spain)</option>
        <option value="ceb" data-flag="ph">Cebuano (Philippines)</option>
        <option value="ces" data-flag="cz">Czech (Czech Republic)</option>
        <option value="chi_sim" data-flag="cn">Chinese (Simplified) (China)</option>
        <option value="chi_sim_vert" data-flag="cn">Chinese (Simplified, Vertical) (China)</option>
        <option value="chi_tra" data-flag="tw">Chinese (Traditional) (Taiwan)</option>
        <option value="chi_tra_vert" data-flag="tw">Chinese (Traditional, Vertical) (Taiwan)</option>
        <option value="chr" data-flag="us">Cherokee (USA)</option>
        <option value="cos" data-flag="fr">Corsican (France)</option>
        <option value="cym" data-flag="gb-wls">Welsh (Wales)</option>
        <option value="dan" data-flag="dk">Danish (Denmark)</option>
        <option value="dan_frak" data-flag="dk">Danish (Fraktur) (Denmark)</option>
        <option value="deu" data-flag="de">German (Germany)</option>
        <option value="deu_frak" data-flag="de">German (Fraktur) (Germany)</option>
        <option value="deu_latf" data-flag="de">German (Latin Fraktur) (Germany)</option>
        <option value="div" data-flag="mv">Dhivehi (Maldives)</option>
        <option value="dzo" data-flag="bt">Dzongkha (Bhutan)</option>
        <option value="ell" data-flag="gr">Greek (Greece)</option>
        <option value="eng" selected data-flag="us">English (USA)</option>
        <option value="enm" data-flag="gb">Middle English (UK)</option>
        <option value="epo" data-flag="eu">Esperanto (International)</option>
        <option value="equ" data-flag="eu">Math Equations (International)</option>
        <option value="est" data-flag="ee">Estonian (Estonia)</option>
        <option value="eus" data-flag="es">Basque (Spain)</option>
        <option value="fao" data-flag="fo">Faroese (Faroe Islands)</option>
        <option value="fas" data-flag="ir">Persian (Iran)</option>
        <option value="fil" data-flag="ph">Filipino (Philippines)</option>
        <option value="fin" data-flag="fi">Finnish (Finland)</option>
        <option value="fra" data-flag="fr">French (France)</option>
        <option value="frm" data-flag="fr">Middle French (France)</option>
        <option value="fry" data-flag="nl">Frisian (Netherlands)</option>
        <option value="gla" data-flag="gb-sct">Scottish Gaelic (Scotland)</option>
        <option value="gle" data-flag="ie">Irish (Ireland)</option>
        <option value="glg" data-flag="es">Galician (Spain)</option>
        <option value="grc" data-flag="gr">Ancient Greek (Greece)</option>
        <option value="guj" data-flag="in">Gujarati (India)</option>
        <option value="hat" data-flag="ht">Haitian Creole (Haiti)</option>
        <option value="heb" data-flag="il">Hebrew (Israel)</option>
        <option value="hin" data-flag="in">Hindi (India)</option>
        <option value="hrv" data-flag="hr">Croatian (Croatia)</option>
        <option value="hun" data-flag="hu">Hungarian (Hungary)</option>
        <option value="hye" data-flag="am">Armenian (Armenia)</option>
        <option value="iku" data-flag="ca">Inuktitut (Canada)</option>
        <option value="ind" data-flag="id">Indonesian (Indonesia)</option>
        <option value="isl" data-flag="is">Icelandic (Iceland)</option>
        <option value="ita" data-flag="it">Italian (Italy)</option>
        <option value="ita_old" data-flag="it">Old Italian (Italy)</option>
        <option value="jav" data-flag="id">Javanese (Indonesia)</option>
        <option value="jpn" data-flag="jp">Japanese (Japan)</option>
        <option value="jpn_vert" data-flag="jp">Japanese (Vertical) (Japan)</option>
        <option value="kan" data-flag="in">Kannada (India)</option>
        <option value="kat" data-flag="ge">Georgian (Georgia)</option>
        <option value="kat_old" data-flag="ge">Old Georgian (Georgia)</option>
        <option value="kaz" data-flag="kz">Kazakh (Kazakhstan)</option>
        <option value="khm" data-flag="kh">Khmer (Cambodia)</option>
        <option value="kir" data-flag="kg">Kyrgyz (Kyrgyzstan)</option>
        <option value="kmr" data-flag="tr">Kurmanji (Turkey)</option>
        <option value="kor" data-flag="kr">Korean (South Korea)</option>
        <option value="kor_vert" data-flag="kr">Korean (Vertical) (South Korea)</option>
        <option value="lao" data-flag="la">Lao (Laos)</option>
        <option value="lat" data-flag="va">Latin (Vatican)</option>
        <option value="lav" data-flag="lv">Latvian (Latvia)</option>
        <option value="lit" data-flag="lt">Lithuanian (Lithuania)</option>
        <option value="ltz" data-flag="lu">Luxembourgish (Luxembourg)</option>
        <option value="mal" data-flag="in">Malayalam (India)</option>
        <option value="mar" data-flag="in">Marathi (India)</option>
        <option value="mkd" data-flag="mk">Macedonian (North Macedonia)</option>
        <option value="mlt" data-flag="mt">Maltese (Malta)</option>
        <option value="mon" data-flag="mn">Mongolian (Mongolia)</option>
        <option value="mri" data-flag="nz">Maori (New Zealand)</option>
        <option value="msa" data-flag="my">Malay (Malaysia)</option>
        <option value="mya" data-flag="mm">Burmese (Myanmar)</option>
        <option value="nep" data-flag="np">Nepali (Nepal)</option>
        <option value="nld" data-flag="nl">Dutch (Netherlands)</option>
        <option value="nor" data-flag="no">Norwegian (Norway)</option>
        <option value="oci" data-flag="fr">Occitan (France)</option>
        <option value="ori" data-flag="in">Odia (India)</option>
        <option value="pan" data-flag="in">Punjabi (India)</option>
        <option value="pol" data-flag="pl">Polish (Poland)</option>
        <option value="por" data-flag="pt">Portuguese (Portugal)</option>
        <option value="pus" data-flag="af">Pashto (Afghanistan)</option>
        <option value="que" data-flag="pe">Quechua (Peru)</option>
        <option value="ron" data-flag="ro">Romanian (Romania)</option>
        <option value="rus" data-flag="ru">Russian (Russia)</option>
        <option value="san" data-flag="in">Sanskrit (India)</option>
        <option value="sin" data-flag="lk">Sinhala (Sri Lanka)</option>
        <option value="slk" data-flag="sk">Slovak (Slovakia)</option>
        <option value="slv" data-flag="si">Slovenian (Slovenia)</option>
        <option value="snd" data-flag="pk">Sindhi (Pakistan)</option>
        <option value="spa" data-flag="es">Spanish (Spain)</option>
        <option value="sqi" data-flag="al">Albanian (Albania)</option>
        <option value="srp" data-flag="rs">Serbian (Serbia)</option>
        <option value="srp_latn" data-flag="rs">Serbian (Latin) (Serbia)</option>
        <option value="sun" data-flag="id">Sundanese (Indonesia)</option>
        <option value="swa" data-flag="ke">Swahili (Kenya)</option>
        <option value="swe" data-flag="se">Swedish (Sweden)</option>
        <option value="syr" data-flag="sy">Syriac (Syria)</option>
        <option value="tam" data-flag="in">Tamil (India)</option>
        <option value="tat" data-flag="ru">Tatar (Russia)</option>
        <option value="tel" data-flag="in">Telugu (India)</option>
        <option value="tgk" data-flag="tj">Tajik (Tajikistan)</option>
        <option value="tgl" data-flag="ph">Tagalog (Philippines)</option>
        <option value="tha" data-flag="th">Thai (Thailand)</option>
        <option value="tir" data-flag="er">Tigrinya (Eritrea)</option>
        <option value="ton" data-flag="to">Tongan (Tonga)</option>
        <option value="tur" data-flag="tr">Turkish (Turkey)</option>
        <option value="uig" data-flag="cn">Uyghur (China)</option>
        <option value="ukr" data-flag="ua">Ukrainian (Ukraine)</option>
        <option value="urd" data-flag="pk">Urdu (Pakistan)</option>
        <option value="uzb" data-flag="uz">Uzbek (Uzbekistan)</option>
        <option value="vie" data-flag="vn">Vietnamese (Vietnam)</option>
        <option value="yid" data-flag="il">Yiddish (Israel)</option>
        <option value="yor" data-flag="ng">Yoruba (Nigeria)</option>
                </select>
              </div>
              <div class="modal-footer m-0 p-0">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `);

    // Initialize Select2 after modal is shown
    $(_idViewL).on('shown.bs.modal', function () {
        $(`#ocrLang${fileIndex}`).select2({
            templateResult: formatOption,
            templateSelection: formatOption,
            width: 'resolve',
            dropdownParent: $(_idViewL)
        }).on('select2:select', function (e) {
            const flagCode = $(e.params.data.element).data('flag')?.toString().toUpperCase();
            $(`#_selectedLang${fileIndex}`)
                .html(`Selected: ${flagCode}`)
                .removeClass('bg-secondary')
                .addClass('bg-success');
        });
    });

    $(_idViewL).modal("show");
}

// Format option for Select2
function formatOption(option) {
    if (!option.id) return option.text;
    return $(
        '<span class="flag-option">' +
        '<span class="flag-icon flag-icon-' + $(option.element).data('flag') + '"></span>' +
        option.text +
        '</span>'
    );
}

// Download text file
function downloadTextFile(element) {
    const fileIndex = element.data('fi');
    const fileName = element.data('fn');
    const textarea = document.getElementById(`_PageDetailBody1${fileIndex}`);
    const textContent = textarea.value;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const blobURL = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobURL;
    link.download = fileName;
    link.click();

    downloadCleanup(blobURL, useForAndroid === 1);
}

// Download Cleanup
function downloadCleanup(blobURL, isAndroid) {
    if (!isAndroid) {
        // Single delayed cleanup is sufficient
        setTimeout(() => {
            try {
                URL.revokeObjectURL(blobURL);
                console.log('Blob URL revoked:', blobURL);
            } catch (error) {
                console.error('Error revoking Blob URL:', error);
            }
        }, 1000);
    }
}

// Download all text files as ZIP
async function downloadAllTextFiles() {
    const zip = new JSZip();
    const uploadedFiles = fileInput.files;

    try {
        for (let i = 0; i < uploadedFiles.length; i++) {
            if (filesToIgnore.includes(i)) continue;

            const currentFile = uploadedFiles[i];
            const textFileName = currentFile.name.replace(/\.[^/.]+$/, '.txt');
            const extractedText = await retrieveStoredText(i);
            const formattedText = extractedText.replace(/<br>/g, '\n');

            zip.file(textFileName, formattedText);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const blobURL = URL.createObjectURL(zipBlob);

        const downloadLink = document.createElement("a");
        downloadLink.href = blobURL;
        downloadLink.download = zipFileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        downloadCleanup(blobURL, useForAndroid === 1);
    } catch (error) {
        console.error("Error creating ZIP file:", error);
    }
}

// Retrieve stored text from IndexedDB
async function retrieveStoredText(fileID) {
    return new Promise((resolve, reject) => {
        const dbRequest = indexedDB.open(DB_NAME, 1);

        dbRequest.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(['pages'], 'readonly');
            const objectStore = transaction.objectStore('pages');
            const index = objectStore.index('fileID');
            const _ID = randomNumber + fileID;

            const request = index.getAll(IDBKeyRange.only(_ID));

            request.onsuccess = function (event) {
                const results = event.target.result;
                if (results) {
                    results.sort((a, b) => a.pageNumber - b.pageNumber);
                    const concatenatedText = results.map(record =>
                        `(Page #${record.pageNumber})<br>===================<br>${record.pageText}<br><br>`
                    ).join(' ');
                    resolve(concatenatedText);
                } else {
                    reject('No data found for this image');
                }
            };

            request.onerror = function (event) {
                reject('Error retrieving data: ' + event.target.errorCode);
            };
        };

        dbRequest.onerror = function (event) {
            reject('Error opening database: ' + event.target.errorCode);
        };
    });
}

// Clean up expired records from IndexedDB
function cleanupExpiredRecords() {
    const dbRequest = indexedDB.open(data, 1);

    dbRequest.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction(['pages'], 'readwrite');
        const objectStore = transaction.objectStore('pages');
        const currentTime = Date.now();

        const cursorRequest = objectStore.openCursor();

        cursorRequest.onsuccess = function (event) {
            const cursor = event.target.result;
            if (cursor) {
                const record = cursor.value;
                if (record.expire <= currentTime) {
                    objectStore.delete(cursor.key);
                }
                cursor.continue();
            }
        };

        cursorRequest.onerror = function (event) {
            console.error('Cursor error:', event.target.error);
        };
    };

    dbRequest.onerror = function (event) {
        console.error('Database error:', event.target.error);
    };
}

// Validate uploaded files
async function validateUploadedFiles(inputElement) {
    const maxFiles = allowMaxFiles;
    const maxFileSizeMB = allowFileSize;
    const allowedFileType = fileType;
    const files = inputElement.files;

    if (files.length > maxFiles) {
        alert(`Maximum ${maxFiles} ${fileExt} are allowed.`);
        return false;
    }

    for (let file of files) {
        if (file.type !== allowedFileType) {
            alert(`Only ${fileExt} are allowed. Found: ${file.name}`);
            return false;
        }

        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > maxFileSizeMB) {
            alert(`File ${file.name} exceeds the maximum allowed size of ${maxFileSizeMB} MB.`);
            return false;
        }
    }

    return true;
}

// Generate random number
function generateRandomNumber() {
    return Math.floor(100000 + Math.random() * 900000);
}

// Origin check security function
function checkOrigin() {
    const siteName = "onlineocr.io"; // This would be dynamically generated in the original code
    const randomValue = 42; // This would be dynamically calculated in the original code

    if (randomValue !== 0 && !window.location.host.includes(siteName)) {
        document.body.innerHTML = '';
        window.location.href = "https://www.google.com"; // This would be decrypted in the original code
    }
}
// Initialize database with proper error handling
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);

        request.onerror = (event) => {
            reject(`Database error: ${event.target.error}`);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('fileID', 'fileID', { unique: false });
                store.createIndex('pageNumber', 'pageNumber', { unique: false });
                store.createIndex('expire', 'expire', { unique: false });
                console.log('Database store and indexes created');
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
    });
}

// Safe storage function
async function storePageText(fileID, pageNumber, pageText) {
    try {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            // Verify store exists
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                reject(`Store ${STORE_NAME} not found`);
                return;
            }

            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            transaction.onerror = (event) => {
                reject(`Transaction failed: ${event.target.error}`);
            };

            const request = store.add({
                fileID: randomNumber + fileID,
                pageNumber: pageNumber,
                pageText: pageText,
                expire: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
            });

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(`Store failed: ${event.target.error}`);
        });
    } catch (err) {
        console.error('Storage error:', err);
        throw err;
    }
}

// Safe cleanup function
async function deleteExpiredRecords() {
    try {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                resolve(0); // No store exists = nothing to delete
                return;
            }

            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Verify index exists
            if (!store.indexNames.contains('expire')) {
                resolve(0); // No index = nothing to delete
                return;
            }

            const cutoff = Date.now();
            const range = IDBKeyRange.upperBound(cutoff);
            const cursorRequest = store.index('expire').openCursor(range);

            let deletedCount = 0;

            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };

            cursorRequest.onerror = (event) => {
                reject(`Cleanup failed: ${event.target.error}`);
            };
        });
    } catch (err) {
        console.error('Cleanup error:', err);
        throw err;
    }
}
function toggleOcrPreview() {
    const $preview = $("#OcrPreview");
    const $copyBtn = $("#copyPreviewText");
    const $toggleIcon = $("#togglePreviewIcon");
    const $tt = $('#liveOcrIc')
    const isVisible = $preview.is(":visible");

    $preview.toggle();
    $copyBtn.toggle();

    $tt.html(isVisible ? "<i class='bi bi-eye-fill'></i> Live Text Extraction" : '<i class="bi bi-eye-slash-fill"></i> Live Text Extraction');
} function showHtmlAlert(messageHtml) {
    document.getElementById("customHtmlModalBody").innerHTML = messageHtml;
    const modal = new bootstrap.Modal(document.getElementById("customHtmlModal"));
    modal.show();
}
(function () {
    let devtoolsOpen = false;

    function detectDevTools() {
        const start = performance.now();
        debugger;
        const end = performance.now();
        if (end - start > 100) {
            devtoolsOpen = true;
            document.body.innerHTML = '<h1 style="color:red;text-align:center;">Blocked due to dev tools</h1>';
        }
    }

    setInterval(detectDevTools, 1000);
})();