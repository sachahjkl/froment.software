#import "shared.typ": document
#let data = json("../input/document.json")
#document(data, compact: true)
