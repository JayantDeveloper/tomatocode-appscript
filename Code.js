const BACKEND_URL = "https://tomato-slides.loca.lt/api/sessions/upload";
const TEACHER_VIEW_BASE_URL = "http://localhost:3000/teacher/";
const CODING_SLIDE_MARKER = "[TOMATOCODE_QUESTION]"; 

function onOpen(e) {
  SlidesApp.getUi()
    .createAddonMenu()
    .addItem('Open TomatoCode Controls', 'openSidebar')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('TomatoCode Controls');
  SlidesApp.getUi().showSidebar(html);
}

function openEmptyQuestionDialog() {
  const html = HtmlService.createHtmlOutputFromFile('QuestionDialog')
    .setWidth(350)
    .setHeight(150);
  SlidesApp.getUi().showModalDialog(html, 'Add Code Question Marker');
}

function addInteractiveSlideMarker() {
  const presentation = SlidesApp.getActivePresentation();
  const selection = presentation.getSelection();
  const currentPage = selection.getCurrentPage();
  if (!currentPage || currentPage.getPageType() !== SlidesApp.PageType.SLIDE) return;

  const slide = currentPage.asSlide();
  const notesPage = slide.getNotesPage();
  const speakerNotesShape = notesPage.getSpeakerNotesShape();

  if (!speakerNotesShape) {
    notesPage.getPlaceholder(SlidesApp.PlaceholderType.BODY)
      .asShape().getText().setText(CODING_SLIDE_MARKER + "\nPrompt: [Enter your question prompt here]");
  } else {
    const notes = speakerNotesShape.getText().asString();
    if (!notes.includes(CODING_SLIDE_MARKER)) {
      speakerNotesShape.getText().insertText(0, CODING_SLIDE_MARKER + "\nPrompt: [Enter your question prompt here]\n\n");
    } else {
      SlidesApp.getUi().alert("This slide is already marked as a coding question.");
      return;
    }
  }

  SlidesApp.getUi().alert("Coding question marker added to speaker notes.");
}

function initiateLessonSession() {
  const presentation = SlidesApp.getActivePresentation();
  const presentationTitle = presentation.getName();
  const presentationId = presentation.getId();
  const file = DriveApp.getFileById(presentationId);
  const pdfBlob = file.getAs('application/pdf').setName(presentationTitle + '.pdf');

  // ✅ Extract speaker notes from each slide
  const notesArray = presentation.getSlides().map(slide => {
    const speakerNotesShape = slide.getNotesPage().getSpeakerNotesShape();
    if (!speakerNotesShape) return "";
    return speakerNotesShape.getText().asString().trim();
  });

  const formData = {
    file: pdfBlob,
    presentationId,
    title: presentationTitle,
    notes: JSON.stringify(notesArray), // 👈 Send notes as string
  };

  const options = {
    method: 'post',
    payload: formData,
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(BACKEND_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 201) {
      const jsonResponse = JSON.parse(responseBody);
      if (jsonResponse.success && jsonResponse.sessionCode) {
        return TEACHER_VIEW_BASE_URL + jsonResponse.sessionCode;
      } else {
        throw new Error("Unexpected response: " + responseBody);
      }
    } else {
      throw new Error(`Backend error (${responseCode}): ${responseBody}`);
    }
  } catch (err) {
    console.error("initiateLessonSession error:", err);
    throw new Error("Failed to start lesson session. " + err.message);
  }
}
