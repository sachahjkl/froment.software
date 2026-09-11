#let stack-lines(lines, gap: 0.8mm) = {
  for line in lines {
    block(spacing: gap)[#line]
  }
}

#let text-spans(spans) = {
  for span in spans {
    let content = span.text.split("\n").map(line => text(line)).join(linebreak())
    if span.bold { content = strong(content) }
    if span.italic { content = emph(content) }
    content
  }
}

#let text-blocks(blocks) = {
  for item in blocks {
    if item.kind == "paragraph" {
      if item.spans.len() == 0 {
        block(height: 1em, spacing: 2.5mm)[]
      } else {
        block(spacing: 2.5mm)[#text-spans(item.spans)]
      }
    } else if item.kind == "heading" {
      block(sticky: true, above: 3mm, below: 1.5mm)[
        #text(size: if item.level == 2 { 10pt } else { 9pt }, weight: "bold")[#text-spans(item.spans)]
      ]
    } else if item.kind == "list" {
      let items = item.items.map(text-blocks)
      if item.ordered { enum(start: item.start, ..items) } else { list(..items) }
    }
  }
}

#let legal-notices(lines) = {
  if lines.len() > 0 {
    v(4mm)
    set text(size: 7pt, weight: "regular")
    stack-lines(lines, gap: 1.5mm)
  }
}

#let document(data, preview: false) = {
  let line-gap = 1.4mm
  let row-inset = 1.3mm

  set page(
    paper: "a4", margin: 12.7mm, fill: white,
    background: if preview {
      align(center + horizon, rotate(-35deg,
        text(font: "Cousine", size: 64pt, weight: "bold", fill: rgb("dedede"))[PREVIEW],
      ))
    } else { none },
  )
  set text(font: ("Cousine", "Liberation Mono"), size: 8.5pt, weight: "bold")
  set par(leading: 0.65em)

  grid(
    columns: (1fr, 78mm),
    gutter: 9mm,
    align: top,
    stack-lines(data.issuer, gap: line-gap),
    box(width: 100%, stroke: 0.25mm + rgb("555555"), inset: (x: 2.2mm, y: 1.2mm))[
      #stack(
        spacing: line-gap,
        ..data.metadata.map(pair => grid(
          columns: (39mm, 1fr),
          gutter: 2mm,
          pair.at(0),
          pair.at(1),
        )),
      )
    ],
  )

  v(6mm)
  strong(data.clientHeading)
  stack-lines(data.client, gap: line-gap)

  if data.context.len() > 0 {
    v(3mm)
    stack-lines(data.context, gap: line-gap)
  }

  align(center)[#v(6mm) #data.title]
  v(1mm)

  table(
    columns: (8mm, 1fr, 26mm, 13mm, 16mm, 27mm),
    align: (center, left, right, right, right, right),
    stroke: none,
    inset: (right: 1.8mm, top: row-inset, bottom: row-inset),
    table.header(
      table.cell(breakable: false)[#data.lineHeadings.at(0)],
      table.cell(breakable: false)[#data.lineHeadings.at(1)],
      table.cell(breakable: false)[#data.lineHeadings.at(2)],
      table.cell(breakable: false)[#data.lineHeadings.at(3)],
      table.cell(breakable: false)[#data.lineHeadings.at(4)],
      table.cell(breakable: false)[#data.lineHeadings.at(5)],
      table.hline(stroke: 0.25mm + rgb("555555")),
    ),
    ..data.lines.map(line => (
      table.cell()[#line.position],
      table.cell()[#line.description],
      table.cell()[#line.unitPrice],
      table.cell()[#line.quantity],
      table.cell()[#line.vat],
      table.cell()[#line.amount],
    )).flatten(),
    table.hline(stroke: 0.25mm + rgb("555555")),
  )

  align(right)[
    #grid(
      columns: (auto, 28mm),
      column-gutter: 2.5mm,
      row-gutter: line-gap,
      align: right,
      ..data.totals.enumerate().map(pair => {
        let index = pair.at(0)
        let total = pair.at(1)
        let cells = (total.at(0), total.at(1))
        if index == data.totals.len() - 1 {
          (grid.cell(stroke: (top: 0.75mm + rgb("555555")), inset: (top: line-gap))[#cells.at(0)], grid.cell(stroke: (top: 0.75mm + rgb("555555")), inset: (top: line-gap))[#cells.at(1)])
        } else { cells }
      }).flatten(),
    )
  ]

  if data.termsPlacement == "new-page" {
    legal-notices(data.legal)
  }

  if data.terms.len() > 0 {
    if data.termsPlacement == "new-page" { pagebreak(weak: true) }
    v(5mm)
    if type(data.terms) == str {
      strong(data.termsHeading)
      linebreak()
      data.terms
    } else {
      set text(weight: "regular")
      block(sticky: true, below: 2.5mm)[#strong(data.termsHeading)]
      text-blocks(data.terms)
    }
  }

  if data.termsPlacement != "new-page" {
    legal-notices(data.legal)
  }

  v(5mm)
  align(center)[\*\*\* #linebreak() #v(1.5mm) #data.thankYou #linebreak() #v(1.5mm) #strong(data.footer)]
}
