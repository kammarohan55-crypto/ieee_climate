# BDG2 reference demand benchmark

Original anonymized US education buildings; not London campus measurements.

Source: https://media.githubusercontent.com/media/buds-lab/building-data-genome-project-2/9b97ccbe90096aff42ed4fd6493bf7ae692d7118/data/meters/raw/water.csv

Paper: https://www.nature.com/articles/s41597-020-00712-x

Attribution: Miller et al. and Building Data Genome 2 contributors (2020)

Data license: upstream Attribution-ShareAlike license retained in LICENSE-BDG2.txt. Clipped data, metadata and derived benchmark artifacts retain these terms; application code has its own license.

Reproduce with scripts/train-campus-demand.py and its pinned requirements. The entire unmodified source is fetched into ignored outputs only; the public file retains three original columns.

The frozen 2017 test follows the declared 2016 training and validation split. Missing days and their dependent lag windows are excluded equally from all evaluated methods. Quantile outputs use a nonnegative, enclosing interval correction, whose empirical coverage is reported. No intervention date or achieved savings is invented.
