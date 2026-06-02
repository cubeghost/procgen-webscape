---
layout: layouts/home.html
tags: portfolio

title: kid pix 1.0 zine
portfolioTitle: 1.0 zine
preview:
  src: /kidpix/zine/00.png
  alt: page 1
---

{% for i in (0..14) -%}
<img src="./{{ i | prepend: '00' | slice: -2, 2 }}.png" alt="page {{ i + 1 }}">
{%- endfor %}
