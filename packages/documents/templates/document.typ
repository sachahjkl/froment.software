#import "shared.typ": document as render-document
#let data = json("../input/document.json")
#let preview-title = sys.inputs.at("preview-title", default: none)
#if preview-title != none {
  set document(title: preview-title)
  render-document(data, preview: true)
} else {
  render-document(data)
}
