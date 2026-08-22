#let stack-lines(lines, gap: 0.8mm) = {
  for line in lines {
    block(spacing: gap)[#line]
  }
}

#let document(data) = {
  let line-gap = 1.4mm
  let row-inset = 1.3mm

  set page(paper: "a4", margin: 12.7mm, fill: white)
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
      table.cell(breakable: false)[#line.position],
      table.cell(breakable: false)[#line.description],
      table.cell(breakable: false)[#line.unitPrice],
      table.cell(breakable: false)[#line.quantity],
      table.cell(breakable: false)[#line.vat],
      table.cell(breakable: false)[#line.amount],
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

  if data.terms.len() > 0 {
    v(5mm)
    strong(data.termsHeading)
    linebreak()
    data.terms
  }

  if data.legal.len() > 0 {
    v(4mm)
    set text(size: 7pt, weight: "regular")
    stack-lines(data.legal, gap: 1.5mm)
  }

  v(5mm)
  align(center)[\*\*\* #linebreak() #v(1.5mm) #data.thankYou #linebreak() #v(1.5mm) #strong(data.footer)]
}
