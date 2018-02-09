# mrz-detection

## Run scripts

The best way to test the run scripts is to create a `data` directory in the root of this repo and put
the images in sub-directories of `data`.

### getMrz

`node run/getMrz.js --dir data/imageDir`

This script will treat all PNG or JPEG images in the specified `dir` and create an `out` sub-directory
containing the images at each step of the process.
The purpose of this script is to locate the MRZ and crop/rotate the image to keep only this part.

Final images will be in `data/imageDir/out/cropped`

### readMrz

`node run/readMrz.js --dir data/imageDir/out/cropped --reference data/imageDir/ground.csv`

This script will attempt to read the MRZ of all images in the specified `dir` and compare the read
data with the `reference`.

The reference should be a CSV file with the following format:

image-name,MRZ-LINE-1,MRZ-LINE-2,MRZ-LINE-3

* image-name is the filename of the original image without extension
* MRZ-LINE-x are each line of the MRZ (two or three lines)

## License

[MIT](./LICENSE)
