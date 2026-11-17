

## Overview

`hmt_apps` is a repository for developing single-page webapps using the datasets built by the Homer Multitext project and published in a single delimited-text file at https://raw.githubusercontent.com/homermultitext/hmt-archive/refs/heads/master/releases-cex/hmt-current.cex





## Functionality

Each of the apps developed in this repository should be contained in a single HTML file that can function either when served from a web server, or when opened from a local file. Code reused in multiple notebooks can be shared for better single-source maintenance and development, and the indiidual HTML files assembled in a build project.

## Source data 



## Architecture & Directory Structure

- `quarto`, `docs`, `README.md`, `releases.md`, and `version.txt` are all user-readable content owned by me; Claude should not touch them
- `notes` is for documentation and notes that Claude writes, includes session summaries so I can reliably pick up working with Claude from different machines
- `src` is for source code


## Testing Guidelines

- Write unit tests for utility functions and integration/component tests for critical UI flows.
- Run relevant tests before proposing significant refactors.