# MobileGym Paper Landing Page

Single-file static landing page for the paper, designed to be deployed on GitHub Pages.

## File

- `index.html` — full landing page, uses Tailwind CSS via CDN (no build step required)

## Local preview

```bash
npm run dev
# then visit http://localhost:3000/web/index.html
```

Vite serves both the paper page and the embedded simulator from the same
origin. **Same origin is required** — the page patches `scrollIntoView` /
`focus` inside the iframe so interacting with the simulator (opening chats,
typing, sending messages) doesn't drag the surrounding paper page along. A
cross-origin iframe (e.g. paper hosted at one origin, simulator at another)
won't allow that patch and the demo will hijack the parent scroll.

For deployment, ship the paper and simulator under the same host
(e.g. `https://example.com/paper/` + `https://example.com/`).

## Things to customize before deploying

Edit `index.html` and replace the placeholders:

| Placeholder | Where | Replace with |
|------------|------|------------|
| `Author One`, `Author Two`, `Author Three` | header & BibTeX | real author names |
| `Affiliation One`, `Affiliation Two` | header | real affiliations |
| `https://arxiv.org/abs/XXXX.XXXXX` | "Paper" button | actual arXiv link once available |
| `XXXX.XXXXX` | BibTeX block | actual arXiv ID |
| Demo button (currently disabled) | header | once you have a demo URL, replace the `<span>` with an `<a>` |

Search for `XXXX` and `Author` in the file to find them quickly.

## Deployment to GitHub Pages

GitHub Pages can serve from one of:
- the `main` branch root
- the `main` branch `/docs` folder
- a separate `gh-pages` branch

Since this repo's `/docs` is already used for project documentation, we use a **dedicated `gh-pages` branch**. See the parent repo for the deployment steps.
