#let stack-lines(lines, gap: 0.4mm) = {
  for line in lines {
    block(spacing: gap)[#line]
  }
}

#let document(data, compact: false) = {
  set page(paper: "a4", margin: 12.7mm, fill: white)
  set text(font: ("Cousine", "Liberation Mono"), size: 8.5pt, weight: "bold")
  set par(leading: 0.18em)

  grid(
    columns: (1fr, 78mm),
    gutter: 9mm,
    align: top,
    stack-lines(data.issuer),
    box(width: 100%, stroke: 0.25mm + rgb("555555"), inset: (x: 2.2mm, y: 1.2mm))[
      #for pair in data.metadata {
        grid(columns: (39mm, 1fr), gutter: 2mm, pair.at(0), pair.at(1))
      }
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
    inset: (right: 1.8mm, top: 0.6mm, bottom: 0.6mm),
    table.header(
      table.cell(breakable: false)[\#],
      table.cell(breakable: false)[Désignation],
      table.cell(breakable: false)[PU HT],
      table.cell(breakable: false)[Qté],
      table.cell(breakable: false)[TVA],
      table.cell(breakable: false)[Total HT],
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
  align(center)[\*\*\* #linebreak() #v(1.5mm) Merci pour votre confiance. #linebreak() #v(1.5mm) #strong(data.footer)]
}
