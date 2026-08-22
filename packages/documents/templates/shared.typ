#let stack-lines(lines, gap: 0.8mm) = {
  for line in lines {
    block(spacing: gap)[#line]
  }
}

#let document(data, compact: false) = {
  set page(paper: "a4", margin: 12.7mm, fill: white)
  set text(font: ("Cousine", "Liberation Mono"), size: 8.5pt, weight: "bold")
  set par(leading: 0.5em)

  grid(
    columns: (1fr, 78mm),
    gutter: 9mm,
    align: top,
    stack-lines(data.issuer),
    box(width: 100%, stroke: 0.25mm + rgb("555555"), inset: (x: 2.2mm, y: 1.2mm))[
      #stack(
        spacing: 0.8mm,
        ..data.metadata.map(pair => grid(
          columns: (39mm, 1fr),
          gutter: 2mm,
          pair.at(0),
          pair.at(1),
        )),
      )
    ],
  )

  v(if compact { 4mm } else { 6mm })
  strong(data.clientHeading)
  stack-lines(data.client)

  if data.context.len() > 0 {
    v(3mm)
    stack-lines(data.context)
  }

  align(center)[#v(if compact { 4mm } else { 6mm }) #data.title]
  v(1mm)

  table(
    columns: (8mm, 1fr, 26mm, 13mm, 16mm, 27mm),
    align: (center, left, right, right, right, right),
    stroke: none,
    inset: (right: 1.8mm, top: 1mm, bottom: 1mm),
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
      row-gutter: 0.8mm,
      align: right,
      ..data.totals.enumerate().map(pair => {
        let index = pair.at(0)
        let total = pair.at(1)
        let cells = (total.at(0), total.at(1))
        if index == data.totals.len() - 1 {
          (grid.cell(stroke: (top: 0.75mm + rgb("555555")))[#cells.at(0)], grid.cell(stroke: (top: 0.75mm + rgb("555555")))[#cells.at(1)])
        } else { cells }
      }).flatten(),
    )
  ]

  if data.terms.len() > 0 {
    v(if compact { 4mm } else { 5mm })
    strong(data.termsHeading)
    linebreak()
    data.terms
  }

  if data.legal.len() > 0 {
    v(4mm)
    set text(size: 7pt, weight: "regular")
    stack-lines(data.legal, gap: 1.5mm)
  }

  v(if compact { 3mm } else { 5mm })
  align(center)[\*\*\* #linebreak() #v(1.5mm) #data.thankYou #linebreak() #v(1.5mm) #strong(data.footer)]
}
