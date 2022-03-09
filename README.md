# Beet Semantics
Proof of concept semantic highlighter for [beet](https://mcbeet.dev)

## How to install
1) Download the extension [here](https://nightly.link/TheNuclearNexus/BeetSemantics/workflows/node.js/main/artifact.zip)
2) Extract the `highlighter-*.*.*.vsix`
3) Open `Visual Studio Code`
4) Do `Ctrl+Shift+P` or `Cmd+Shift+P` on MacOS
5) Type `Install from VSIX`
6) Select the file you extracted!
### Troubleshooting
<details>
	<summary>Why is the highlighting red?</summary>

Make sure that you have disabled both `language-mcfunction` and `Data-pack Helper Plus`
</details>


## How to run
1) Clone the repo
```
$> git clone https://github.com/TheNuclearNexus/BeetSemantics
```
2) Install the node packages
```
$> npm i
```
3) Install `beet` and `mecha` if you haven't
```
$> pip install beet mecha
```
4) Press `F5` or `Toolbar> Run> Start Debugging`
