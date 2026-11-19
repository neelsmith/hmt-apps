# IIIF manifests and image URN mappings

Short reference for how image URNs, image-server addresses and IIIF manifests relate in this repo. Written 2026-11-19; see `2026-11-17-release-parser.md` for the session history.

## What the release gives us
- Image collections are the CITE collections that `#!datamodels` lists with model `urn:cite2:cite:datamodels.v1:imagemodel` (11 in release 2024c, 5,083 images; `e3img.2017a` is empty).
- Each image has only a URN, a caption and a rights statement. The release has **no image locations and no pixel sizes**.

## URN to image server
- Rule (`imageService` in `src/images.js`): `urn:cite2:<ns>:<coll>.<ver>:<id>` is `http://www.homermultitext.org/iipsrv?IIIF=/project/homer/pyramidal/deepzoom/<ns>/<coll>/<ver>/<id>.tif`. Append `/info.json`, or `/full/2000,/0/default.jpg` for a picture.
- The reverse direction (service address to URN) is `imageUrnFromService` in `src/iiif.js`; it only handles the `hmt` namespace.
- **Confirmed:** `hmt/vaimg/2017a`. The first two canvases of `venetusA.json` use exactly these addresses, and their ids exist in the release as the matching URNs.
- **Assumed, not checked:** `citebl/burney86imgs/v1`, `citelaur/laur32imgs/v1`, `citeecod/gen44imgs/2017a`, and the other `hmt` collections. Neither the sandbox nor the Mac shell can reach homermultitext.org. The base is the constant `IMAGE_SERVICE_BASE`; the per-collection path is fixed by the rule above.

## Manifests
- IIIF Presentation 3, one per collection, modelled on `hmt-archive/iiif/venetusA.json`: one canvas per image, a painting annotation whose body `id` is the `/full/2000,/0/default.jpg` picture, and an `ImageService2` level 1 service whose `id` is the service id.
- Added to that model: collection label, license (`requiredStatement`), and per canvas the image URN and rights (`metadata`). Body height is scaled from the real size (the Venetus A manifest repeats the full size for a 2000 px picture).
- Canvas size comes from each image's `info.json`. Sizes are never guessed: an image without one is left out of its manifest and reported.
- Manifest ids default to `https://neelsmith.github.io/hmt-apps/images/<collection>.json` (guess at the publishing place; `--base-url`).
- The 2000 px picture assumes every image is at least 2000 px wide; true for the manuscript scans seen, not checked for all.

## CEX tables
`image|urn|label` (with a header line). `image` is the image's IIIF **service id**, i.e. the manifest's `body.service[0].id` (`…/<id>.tif`, no `/full/…` request and no `/info.json`); `urn` is the image URN; `label` is the tidied caption. Written by the same script.

Why the service id: the consumer (iiif-cite) looks an image up by its Image API service id. It ignores `http`/`https`, a trailing `/` and `/info.json` when comparing, but not a size request. The first version of the CEX files wrote the 2000 px picture URL (the manifest's `body.id`) instead, so no image matched a URN; fixed 2026-11-19. The keys of `sizes.json` are in the same service-id form.

## Status and next steps
- Written: the 10 CEX files in `scratch/images/`.
- Not written: the manifests. Run `node scripts/make-image-datasets.js` where homermultitext.org is reachable (sizes cached in `scratch/images/sizes.json`; reruns resume; exit code 1 if images are missing).
- First run should settle the assumed paths: a collection whose images are not found says so after 10 requests.
- Code: `src/images.js`, `src/image-datasets.js`, `scripts/make-image-datasets.js`; tests `test/images.test.js`, `test/image-datasets.test.js`.
