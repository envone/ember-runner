# ember-runner build tool Makefile

.PHONY: all build install clean uninstall

all: build

build:
	@echo 'ember-runner built.'
  
install:
	@mkdir -p /usr/local/lib/node_modules/ember-runner && \
		cp -R ./* /usr/local/lib/node_modules/ember-runner/ && \
		ln -snf /usr/local/lib/node_modules/ember-runner/bin/cli.js /usr/local/bin/ember-runner && \
		chmod 755 /usr/local/lib/node_modules/ember-runner/bin/cli.js && \
		echo 'ember-runner installed.'
    
clean:
	@true
  
uninstall:
	@rm -f /usr/local/bin/ember-runner && \
	rm -fr /usr/local/lib/node_modules/ember-runner/ && \
	echo 'ember-runner uninstalled.'